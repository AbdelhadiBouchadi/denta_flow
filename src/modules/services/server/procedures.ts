import "server-only";

import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNotNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";
import { db } from "@/database";
import { services } from "@/database/schema";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import {
  SERVICE_DEFAULT_DURATION,
  SERVICE_SERVER_ERRORS,
} from "../constants";
import {
  getNgapAct,
  NGAP_CHAPTERS,
  planNgapImport,
  searchNgapActs,
  serviceLabelKey,
} from "../ngap";
import {
  ngapImportSchema,
  ngapSearchSchema,
  serviceFormSchema,
  serviceIdSchema,
  serviceUpdateSchema,
} from "../schemas";
import {
  SERVICE_CATEGORY_VALUES,
  SERVICE_STATUS_FILTER_VALUES,
  ServiceStatusFilter,
} from "../types";

/**
 * The clinic's billable catalogue, managed in Paramètres › Actes.
 *
 * There is no `remove`, ever: a treatment keeps its own label and price
 * snapshot, but its `serviceId` must keep resolving. A deactivated service is
 * hidden from new-acte pickers only.
 *
 * NGAP data is reference data looked up by `nomenclatureCode` from
 * ngap-acts.json. The clinic's price is `defaultPriceCents`; the NGAP tariff is
 * never written to a price except as the starting value of an import.
 */

const notFound = () =>
  new TRPCError({ code: "NOT_FOUND", message: SERVICE_SERVER_ERRORS.notFound });

/** Escapes the ILIKE wildcards so a typed "%" matches a literal per cent sign. */
const likePattern = (search: string) =>
  `%${search.replace(/[\\%_]/g, "\\$&")}%`;

/**
 * «détartrage» and «Détartrage» in the same category would be two acts nobody
 * can tell apart in a picker. Checked here, as tags and insurers do.
 */
const assertLabelAvailable = async (
  label: string,
  category: (typeof services.$inferSelect)["category"],
  exceptId?: string,
) => {
  const [taken] = await db
    .select({ id: services.id })
    .from(services)
    .where(
      and(
        eq(services.category, category),
        sql`lower(${services.label}) = lower(${label})`,
        exceptId ? ne(services.id, exceptId) : undefined,
      ),
    )
    .limit(1);

  if (taken) {
    throw new TRPCError({
      code: "CONFLICT",
      message: SERVICE_SERVER_ERRORS.duplicateLabel,
    });
  }
};

const setActive = async (id: string, isActive: boolean) => {
  const [updated] = await db
    .update(services)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(services.id, id))
    .returning();

  if (!updated) throw notFound();
  return updated;
};

/** The codes already carried by a service, active or not. */
const catalogueCodes = async () => {
  const rows = await db
    .select({ code: services.nomenclatureCode })
    .from(services)
    .where(isNotNull(services.nomenclatureCode));

  return new Set(rows.flatMap(({ code }) => (code ? [code] : [])));
};

export const servicesRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(DEFAULT_PAGE),
        pageSize: z
          .number()
          .int()
          .min(MIN_PAGE_SIZE)
          .max(MAX_PAGE_SIZE)
          .default(DEFAULT_PAGE_SIZE),
        search: z.string().nullish(),
        category: z.enum(SERVICE_CATEGORY_VALUES).nullish(),
        status: z
          .enum(SERVICE_STATUS_FILTER_VALUES)
          .default(ServiceStatusFilter.All),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize, search, category, status } = input;
      const trimmed = search?.trim();

      // ONE predicate for the page and the count (05-slice.md §5 rule 6). No
      // staff scoping: the whole clinic reads one catalogue (AGENTS.md §2).
      const where = and(
        trimmed
          ? or(
              ilike(services.label, likePattern(trimmed)),
              ilike(services.nomenclatureCode, likePattern(trimmed)),
            )
          : undefined,
        category ? eq(services.category, category) : undefined,
        status === ServiceStatusFilter.Active
          ? eq(services.isActive, true)
          : status === ServiceStatusFilter.Inactive
            ? eq(services.isActive, false)
            : undefined,
      );

      const rows = await db
        .select({
          id: services.id,
          label: services.label,
          category: services.category,
          defaultPriceCents: services.defaultPriceCents,
          durationMinutes: services.durationMinutes,
          isActive: services.isActive,
          nomenclatureCode: services.nomenclatureCode,
        })
        .from(services)
        .where(where)
        // Active first, then category (enum order), then label; the id keeps
        // rows from shuffling between pages (05-slice.md §5 rule 4).
        .orderBy(
          desc(services.isActive),
          asc(services.category),
          asc(services.label),
          asc(services.id),
        )
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const [totals] = await db
        .select({ count: count() })
        .from(services)
        .where(where);

      // Reference data joined in memory by code — it is not in the database.
      const items = rows.map((row) => {
        const act = getNgapAct(row.nomenclatureCode);
        return {
          ...row,
          ngap: act
            ? {
                letter: act.letter,
                coefficient: act.coefficient,
                referenceTariffCents: act.referenceTariffCents,
                onQuote: act.onQuote === true,
              }
            : null,
        };
      });

      return {
        items,
        total: totals.count,
        totalPages: Math.ceil(totals.count / pageSize),
      };
    }),

  create: adminProcedure
    .input(serviceFormSchema)
    .mutation(async ({ input }) => {
      await assertLabelAvailable(input.label, input.category);

      const [created] = await db.insert(services).values(input).returning();
      return created;
    }),

  update: adminProcedure
    .input(serviceUpdateSchema)
    .mutation(async ({ input }) => {
      // `id` is destructured out: it must never reach .set().
      const { id, ...values } = input;
      await assertLabelAvailable(values.label, values.category, id);

      // Existing treatments keep their own label and price snapshot
      // (08-clinical.md §3) — nothing else is rewritten.
      const [updated] = await db
        .update(services)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(services.id, id))
        .returning();

      if (!updated) throw notFound();
      return updated;
    }),

  /** Reversible: hidden from new-acte pickers, still resolved everywhere else. */
  deactivate: adminProcedure
    .input(serviceIdSchema)
    .mutation(({ input }) => setActive(input.id, false)),

  reactivate: adminProcedure
    .input(serviceIdSchema)
    .mutation(({ input }) => setActive(input.id, true)),

  /**
   * The nomenclature, searched in memory. Admin-only: only the catalogue's
   * editors need it. `chapters` comes from the JSON, so the import dialog's
   * filter never hardcodes a chapter name.
   */
  searchNgap: adminProcedure
    .input(ngapSearchSchema)
    .query(async ({ input }) => {
      // Every chapter holds ≤ 50 acts, so a chapter always fits in one page;
      // `total` lets «Tous» say when it shows only the first `limit`.
      const matches = searchNgapActs({
        query: input.query,
        chapter: input.chapter,
      });
      const codes = await catalogueCodes();

      return {
        chapters: NGAP_CHAPTERS,
        total: matches.length,
        items: matches.slice(0, input.limit).map((act) => ({
          code: act.code,
          designation: act.designation,
          chapter: act.nomenclatureCategory,
          suggestedCategory: act.suggestedCategory,
          letter: act.letter,
          coefficient: act.coefficient,
          referenceTariffCents: act.referenceTariffCents,
          onQuote: act.onQuote === true,
          xrayRequired: act.xrayRequired,
          alreadyInCatalogue: codes.has(act.code),
        })),
      };
    }),

  /**
   * One service per code not already in the catalogue, in a single
   * `insert … values([…])`. Idempotent: a second run creates nothing.
   * The NGAP tariff is the starting fee only — the clinic adjusts it after.
   */
  importNgap: adminProcedure
    .input(
      ngapImportSchema.refine(
        ({ codes }) => codes.every((code) => getNgapAct(code) !== null),
        { message: SERVICE_SERVER_ERRORS.unknownNgapCode, path: ["codes"] },
      ),
    )
    .mutation(async ({ input }) => {
      const existing = await db
        .select({
          category: services.category,
          label: services.label,
          code: services.nomenclatureCode,
        })
        .from(services);

      const { toCreate, skipped } = planNgapImport(input.codes, {
        codes: new Set(existing.flatMap(({ code }) => (code ? [code] : []))),
        labelKeys: new Set(
          existing.map(({ category, label }) => serviceLabelKey(category, label)),
        ),
      });

      if (toCreate.length === 0) return { created: 0, skipped };

      const created = await db
        .insert(services)
        .values(
          toCreate.map((act) => ({
            label: act.designation,
            category: act.suggestedCategory,
            defaultPriceCents: act.referenceTariffCents,
            durationMinutes: SERVICE_DEFAULT_DURATION,
            nomenclatureCode: act.code,
          })),
        )
        .returning({ id: services.id });

      return { created: created.length, skipped };
    }),
});
