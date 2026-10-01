import "server-only";

import { TRPCError } from "@trpc/server";
import type { BatchItem } from "drizzle-orm/batch";
import {
  and,
  count,
  desc,
  eq,
  exists,
  getTableColumns,
  gte,
  ilike,
  inArray,
  lt,
  max,
  min,
  or,
  sql,
  sum,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { z } from "zod";

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";
import { db } from "@/database";
import {
  appointments,
  insurers,
  medicalHistories,
  patients,
  patientTags,
  payments,
  tags,
  treatments,
  user,
} from "@/database/schema";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import {
  medicalHistoryUpsertSchema,
  patientInsertSchema,
  patientUpdateSchema,
} from "../schemas";

// ── Derived scalars ─────────────────────────────────────────────────────────
// Every figure below is computed by Postgres and cast to int, so it arrives as
// a number and can never drift from the rows it summarises (08-clinical.md §3).
// A stored balance in a clinic becomes a billing dispute.
//
// Each correlated subquery is built with the query builder rather than written
// as a raw `sql` string. In a single-table select, drizzle rewrites every
// top-level column of a projection expression to a bare identifier — a hand
// written `WHERE ${treatments.patientId} = ${patients.id}` renders as
// `WHERE "patient_id" = "id"`, which resolves inside the subquery and silently
// returns zero for every row. The builder keeps its own WHERE fully qualified.

/** Only completed and in-progress actes are billed (08-clinical.md §3). */
const BILLED_TREATMENT_STATUSES: (typeof treatments.$inferSelect)["status"][] = [
  "completed",
  "in_progress",
];

const totalAmountCents = sql<number>`COALESCE(${db
  .select({ value: sum(treatments.totalAmountCents) })
  .from(treatments)
  .where(
    and(
      eq(treatments.patientId, patients.id),
      inArray(treatments.status, BILLED_TREATMENT_STATUSES),
    ),
  )}, 0)::int`;

const amountPaidCents = sql<number>`COALESCE(${db
  .select({ value: sum(payments.amountCents) })
  .from(payments)
  .where(eq(payments.patientId, patients.id))}, 0)::int`;

/** May be negative — that is an «Avance». Never clamped (08-clinical.md §3). */
const remainingCents = sql<number>`(${totalAmountCents} - ${amountPaidCents})::int`;

/**
 * An appointment that counts as the patient having been seen, or being
 * expected. `canceled` never happened; `no_show` is the appointment the
 * patient did not turn up to, which is the definition of not a visit.
 */
const ATTENDED_APPOINTMENT_STATUSES: (typeof appointments.$inferSelect)["status"][] =
  ["planned", "confirmed", "arrived", "completed"];

const attendedByPatient = and(
  eq(appointments.patientId, patients.id),
  inArray(appointments.status, ATTENDED_APPOINTMENT_STATUSES),
);

/** The next appointment still on the books. `null` when there is none. */
const nextAppointmentAt: SQL<Date | null> = sql`${db
  .select({ value: min(appointments.startsAt) })
  .from(appointments)
  .where(and(attendedByPatient, gte(appointments.startsAt, sql`NOW()`)))}`.mapWith(
  appointments.startsAt,
);

/** The last time the patient actually came in. `null` for a new dossier. */
const lastVisitAt: SQL<Date | null> = sql`${db
  .select({ value: max(appointments.startsAt) })
  .from(appointments)
  .where(and(attendedByPatient, lt(appointments.startsAt, sql`NOW()`)))}`.mapWith(
  appointments.startsAt,
);

/** «Nombre de visites» — the same predicate as the last visit, counted. */
const visitCount = sql<number>`COALESCE(${db
  .select({ value: count() })
  .from(appointments)
  .where(and(attendedByPatient, lt(appointments.startsAt, sql`NOW()`)))}, 0)::int`;

/** The patient's tags, whole rows, so the pill needs no second query. */
type PatientTagSummary = Pick<
  typeof tags.$inferSelect,
  "id" | "label" | "color" | "icon"
>;

const patientTagSummaries = sql<PatientTagSummary[]>`COALESCE(${db
  .select({
    value: sql`json_agg(
      json_build_object(
        'id', ${tags.id},
        'label', ${tags.label},
        'color', ${tags.color},
        'icon', ${tags.icon}
      ) ORDER BY ${tags.label}
    )`,
  })
  .from(patientTags)
  .innerJoin(tags, eq(tags.id, patientTags.tagId))
  .where(eq(patientTags.patientId, patients.id))}, '[]'::json)`;

// ── Postgres error mapping ──────────────────────────────────────────────────
// drizzle wraps driver errors in DrizzleQueryError, so the original code sits
// on `cause`. Walking the chain handles both the wrapped and the raw form.

const SHORT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
const SHORT_CODE_LENGTH = 4;
const MAX_SHORT_CODE_ATTEMPTS = 6;

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";

const MEDICAL_HISTORY_PATIENT_FK = "medical_histories_patient_id_patients_id_fk";

interface PostgresErrorShape {
  code?: string;
  constraint?: string;
}

const postgresError = (error: unknown): PostgresErrorShape | null => {
  let current: unknown = error;

  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    const candidate = current as Error & PostgresErrorShape;
    if (typeof candidate.code === "string") {
      return { code: candidate.code, constraint: candidate.constraint };
    }
    current = candidate.cause;
  }

  return null;
};

const isShortCodeCollision = (error: unknown) => {
  const pg = postgresError(error);
  return (
    pg?.code === UNIQUE_VIOLATION &&
    (pg.constraint === undefined ||
      pg.constraint === "patients_short_code_unique")
  );
};

/** A tag or an insurer that vanished between the form opening and submitting. */
const isMissingReference = (error: unknown) =>
  postgresError(error)?.code === FOREIGN_KEY_VIOLATION;

const rethrow = (error: unknown): never => {
  if (isMissingReference(error)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Un tag ou une assurance sélectionnée n’existe plus. Actualisez la page, puis réessayez.",
    });
  }
  throw error;
};

/** 4 uppercase characters staff read aloud and write on a physical file. */
const generateShortCode = () =>
  Array.from(
    { length: SHORT_CODE_LENGTH },
    () =>
      SHORT_CODE_ALPHABET[Math.floor(Math.random() * SHORT_CODE_ALPHABET.length)],
  ).join("");

/** Escapes the ILIKE wildcards so a typed "%" matches a literal per cent sign. */
const likePattern = (search: string) =>
  `%${search.replace(/[\\%_]/g, "\\$&")}%`;

const tagLinks = (patientId: string, tagIds: string[]) =>
  tagIds.map((tagId) => ({ patientId, tagId }));

/**
 * The staff member who last saved the dossier médical. A second copy of `user`
 * under its own name, since `user` is already joined as the patient's creator.
 */
const medicalHistoryEditor = alias(user, "medical_history_editor");

// ── Router ──────────────────────────────────────────────────────────────────

export const patientsRouter = createTRPCRouter({
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
        tagId: z.string().nullish(),
        insurerId: z.string().nullish(),
        includeArchived: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize, search, tagId, insurerId, includeArchived } =
        input;

      // A search typed as "0612…" must still find a phone stored as "+2126…".
      const phonePatterns = search
        ? [
            likePattern(search),
            ...(/^0\d+$/.test(search.trim())
              ? [likePattern(`+212${search.trim().slice(1)}`)]
              : []),
          ]
        : [];

      // ONE predicate, shared by the page query and the count query, so they
      // can never drift (05-slice.md §5 rule 6). No staff scoping: every
      // authenticated staff member sees the whole clinic (AGENTS.md §2).
      const where = and(
        includeArchived ? undefined : eq(patients.isArchived, false),
        search
          ? or(
              ilike(patients.lastName, likePattern(search)),
              ilike(patients.firstName, likePattern(search)),
              ilike(patients.shortCode, likePattern(search)),
              ...phonePatterns.map((pattern) => ilike(patients.phone, pattern)),
            )
          : undefined,
        tagId
          ? exists(
              db
                .select({ one: sql`1` })
                .from(patientTags)
                .where(
                  and(
                    eq(patientTags.patientId, patients.id),
                    eq(patientTags.tagId, tagId),
                  ),
                ),
            )
          : undefined,
        insurerId ? eq(patients.insurerId, insurerId) : undefined,
      );

      const items = await db
        .select({
          id: patients.id,
          shortCode: patients.shortCode,
          firstName: patients.firstName,
          lastName: patients.lastName,
          phone: patients.phone,
          cin: patients.cin,
          gender: patients.gender,
          // Read only by the row avatar, which draws an illustrated persona
          // for an adult of known sex and initials for anyone else.
          birthDate: patients.birthDate,
          isArchived: patients.isArchived,
          tags: patientTagSummaries,
          nextAppointmentAt,
          totalAmountCents,
          amountPaidCents,
          remainingCents,
        })
        .from(patients)
        .where(where)
        // The id tiebreaker keeps rows from shuffling between pages when two
        // patients share a creation timestamp (05-slice.md §5 rule 4).
        .orderBy(desc(patients.createdAt), desc(patients.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const [totals] = await db
        .select({ count: count() })
        .from(patients)
        .where(where);

      return {
        items,
        total: totals.count,
        totalPages: Math.ceil(totals.count / pageSize),
      };
    }),

  getOne: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      // Archived patients resolve too — the dossier is where «Réactiver» lives.
      const [existing] = await db
        .select({
          ...getTableColumns(patients),
          insurer: insurers,
          tags: patientTagSummaries,
          nextAppointmentAt,
          lastVisitAt,
          visitCount,
          totalAmountCents,
          amountPaidCents,
          remainingCents,
          // Audit, shown as «créé par» on the Informations tab. Joined, never
          // used as a filter (AGENTS.md §2).
          createdByStaff: { id: user.id, name: user.name },
          // A left join: `null` means the dossier médical was never filled
          // in, which the tab must tell apart from «filled, nothing to report».
          medicalHistory: medicalHistories,
          medicalHistoryEditor: {
            id: medicalHistoryEditor.id,
            name: medicalHistoryEditor.name,
          },
        })
        .from(patients)
        .leftJoin(insurers, eq(patients.insurerId, insurers.id))
        .leftJoin(user, eq(patients.createdByStaffId, user.id))
        .leftJoin(medicalHistories, eq(medicalHistories.patientId, patients.id))
        .leftJoin(
          medicalHistoryEditor,
          eq(medicalHistories.updatedByStaffId, medicalHistoryEditor.id),
        )
        .where(eq(patients.id, input.id));

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient introuvable.",
        });
      }

      return existing;
    }),

  create: protectedProcedure
    .input(patientInsertSchema)
    .mutation(async ({ input, ctx }) => {
      const { tagIds, ...values } = input;

      // The short code is random, so a collision is possible and cheap to
      // retry. Nothing else in the row can collide.
      for (let attempt = 1; attempt <= MAX_SHORT_CODE_ATTEMPTS; attempt++) {
        const id = nanoid();

        const insertPatient = db
          .insert(patients)
          .values({
            ...values,
            id,
            shortCode: generateShortCode(),
            // Audit only, stamped from the session — never read as a filter
            // and never spread from the input (AGENTS.md §2).
            createdByStaffId: ctx.auth.user.id,
          })
          .returning();

        // One Neon HTTP batch = one transaction: a failed tag link never
        // leaves a patient behind without their tags.
        const writes: [BatchItem<"pg">, ...BatchItem<"pg">[]] =
          tagIds.length > 0
            ? [insertPatient, db.insert(patientTags).values(tagLinks(id, tagIds))]
            : [insertPatient];

        try {
          const [[created]] = await db.batch(writes);
          return created;
        } catch (error) {
          if (isShortCodeCollision(error) && attempt < MAX_SHORT_CODE_ATTEMPTS) {
            continue;
          }
          rethrow(error);
        }
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Impossible de générer un identifiant patient. Veuillez réessayer.",
      });
    }),

  update: protectedProcedure
    .input(patientUpdateSchema)
    .mutation(async ({ input }) => {
      // `id` is destructured out: it must never reach .set() (prompt 10).
      const { id, tagIds, ...values } = input;

      const [existing] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.id, id));

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient introuvable.",
        });
      }

      const updatePatient = db
        .update(patients)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(patients.id, id))
        .returning();

      // Tags are replaced wholesale, in the same transaction as the row.
      const clearTags = db
        .delete(patientTags)
        .where(eq(patientTags.patientId, id));

      const writes: [BatchItem<"pg">, ...BatchItem<"pg">[]] =
        tagIds.length > 0
          ? [
              updatePatient,
              clearTags,
              db.insert(patientTags).values(tagLinks(id, tagIds)),
            ]
          : [updatePatient, clearTags];

      try {
        const [[updated]] = await db.batch(writes);
        return updated;
      } catch (error) {
        return rethrow(error);
      }
    }),

  /**
   * Any staff member may record the history — the assistant often takes it at
   * the front desk. One statement keyed on the unique `patient_id`: two people
   * saving at once both land, last write wins, and no read-then-insert race
   * can create a second row.
   */
  upsertMedicalHistory: protectedProcedure
    .input(medicalHistoryUpsertSchema)
    .mutation(async ({ input, ctx }) => {
      const { patientId, ...fields } = input;

      const values = {
        ...fields,
        // A term only means something while the patient is pregnant; a stale
        // one must not resurface if «Oui» is ticked again later.
        pregnancyWeeks: fields.isPregnant === true ? fields.pregnancyWeeks : null,
        // Audit only, from the session, never from the input (AGENTS.md §2).
        updatedByStaffId: ctx.auth.user.id,
        updatedAt: new Date(),
      };

      try {
        const [saved] = await db
          .insert(medicalHistories)
          .values({ patientId, ...values })
          .onConflictDoUpdate({ target: medicalHistories.patientId, set: values })
          .returning();

        return saved;
      } catch (error) {
        const pg = postgresError(error);

        if (
          pg?.code === FOREIGN_KEY_VIOLATION &&
          pg.constraint === MEDICAL_HISTORY_PATIENT_FK
        ) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Patient introuvable.",
          });
        }
        if (pg?.code === CHECK_VIOLATION) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Le terme doit être un nombre de semaines entre 1 et 42.",
          });
        }
        throw error;
      }
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => setArchived(input.id, true)),

  unarchive: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => setArchived(input.id, false)),

  // DESTRUCTIVE ⇒ admin, and the rejection comes from here, never from a
  // hidden button (AGENTS.md §2).
  remove: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      // One statement. The cascading foreign keys declared on treatments,
      // payments, appointments, documents, patient_tags and odontogram_charts
      // remove exactly the dependent rows — a manual multi-table delete would
      // only be a second, drifting copy of that list.
      const [removed] = await db
        .delete(patients)
        .where(eq(patients.id, input.id))
        .returning();

      if (!removed) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient introuvable.",
        });
      }

      return removed;
    }),
});

/** Archiving hides the patient from the default list; nothing is deleted. */
async function setArchived(id: string, isArchived: boolean) {
  const [updated] = await db
    .update(patients)
    .set({ isArchived, updatedAt: new Date() })
    .where(eq(patients.id, id))
    .returning();

  if (!updated) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Patient introuvable.",
    });
  }

  return updated;
}
