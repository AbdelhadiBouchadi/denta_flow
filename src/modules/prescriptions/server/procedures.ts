import "server-only";

import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/database";
import {
  medications,
  prescriptionPackItems,
  prescriptionPacks,
} from "@/database/schema";
import { logActivity } from "@/modules/activity/server/log";
import {
  MEDICATION_SUMMARIES,
  PRESCRIPTION_PACK_SUMMARIES,
} from "@/modules/activity/summaries";
import { ActivityAction, ActivityEntityType } from "@/modules/activity/types";
import { isUniqueViolation } from "@/modules/documents/numbering";
import { medicalWriterProcedure } from "@/modules/documents/server/medical-procedure";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { PACKS_LIMIT, PRESCRIPTION_SERVER_ERRORS as E } from "../constants";
import { formatMedicationLabel, medicationNameKey } from "../normalize";
import {
  medicationFormSchema,
  medicationGetManySchema,
  medicationSetActiveSchema,
  medicationUpdateSchema,
  packFormSchema,
  packIdSchema,
  packUpdateSchema,
  type PackFormValues,
} from "../schemas";
import { MedicationStatusFilter } from "../types";

/**
 * The ordonnance builder's reference data (prompts/29): the medication
 * catalogue and the packs. Reads are any staff, with no staff scoping
 * (AGENTS.md §2); every write is admin or dentist (`medicalWriterProcedure`,
 * decision 3) and lands with its activity line in ONE `db.batch`
 * (decision 6).
 *
 * Nothing here can change an issued ordonnance: its snapshot copied the
 * text of every line it prints.
 */

// ── Shared ──────────────────────────────────────────────────────────────────

/** Escapes the ILIKE wildcards so a typed "%" matches a literal per cent sign. */
const likePattern = (search: string) =>
  `%${search.replace(/[\\%_]/g, "\\$&")}%`;

const fail = (code: TRPCError["code"], message: string) =>
  new TRPCError({ code, message });

/** The Postgres error under drizzle's wrapping, if any. */
const pgError = (error: unknown) => {
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    const { code, constraint } = current as Error & {
      code?: unknown;
      constraint?: unknown;
    };
    if (typeof code === "string") {
      return { code, constraint: typeof constraint === "string" ? constraint : "" };
    }
    current = current.cause;
  }
  return null;
};

const FOREIGN_KEY_VIOLATION = "23503";

// ── Medications ─────────────────────────────────────────────────────────────

const medicationColumns = {
  id: medications.id,
  name: medications.name,
  form: medications.form,
  strength: medications.strength,
  defaultPosology: medications.defaultPosology,
  defaultDuration: medications.defaultDuration,
  isActive: medications.isActive,
  updatedAt: medications.updatedAt,
};

/**
 * Optimistic concurrency, as for the odontogram: `updated_at` has microsecond
 * precision, the client's token is a millisecond Date — the column is
 * truncated to the token's precision so the comparison is exact.
 */
const medicationVersionMatches = (expectedUpdatedAt: Date) =>
  sql`date_trunc('milliseconds', ${medications.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamp`;

const readMedication = async (id: string) => {
  const [row] = await db
    .select(medicationColumns)
    .from(medications)
    .where(eq(medications.id, id))
    .limit(1);
  if (!row) throw fail("NOT_FOUND", E.medicationNotFound);
  return row;
};

/** A duplicate name + strength reads as French, not as a 500. */
const rethrowDuplicate = (error: unknown, message: string): never => {
  if (isUniqueViolation(error)) throw fail("CONFLICT", message);
  throw error;
};

const medicationLog = (
  id: string,
  action: ActivityAction,
  summary: string,
  staffId: string,
  guard?: Parameters<typeof logActivity>[1],
) =>
  logActivity(
    {
      entityType: ActivityEntityType.Medication,
      entityId: id,
      action,
      patientId: null,
      summary,
      staffId,
    },
    guard,
  );

export const medicationsRouter = createTRPCRouter({
  /**
   * The settings list (searched, filtered, a page at a time) and the
   * builder's picker (`status: active`, one large page).
   */
  getMany: protectedProcedure
    .input(medicationGetManySchema)
    .query(async ({ input }) => {
      const { page, pageSize, status } = input;
      const search = input.search?.trim();

      // ONE predicate for the page and the count (05-slice.md §5 rule 6).
      const where = and(
        search
          ? or(
              ilike(medications.name, likePattern(search)),
              ilike(medications.form, likePattern(search)),
            )
          : undefined,
        status === MedicationStatusFilter.Active
          ? eq(medications.isActive, true)
          : status === MedicationStatusFilter.Inactive
            ? eq(medications.isActive, false)
            : undefined,
      );

      const [items, [totals]] = await Promise.all([
        db
          .select(medicationColumns)
          .from(medications)
          .where(where)
          // Active first, then by name; the id keeps pages stable.
          .orderBy(
            desc(medications.isActive),
            asc(sql`lower(${medications.name})`),
            asc(medications.strength),
            asc(medications.id),
          )
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ count: count() }).from(medications).where(where),
      ]);

      return {
        items,
        total: totals.count,
        totalPages: Math.ceil(totals.count / pageSize),
      };
    }),

  create: medicalWriterProcedure
    .input(medicationFormSchema)
    .mutation(async ({ input, ctx }) => {
      const id = nanoid();
      try {
        const [[created]] = await db.batch([
          db
            .insert(medications)
            .values({
              ...input,
              id,
              nameKey: medicationNameKey(input.name, input.strength),
            })
            .returning(medicationColumns),
          medicationLog(
            id,
            ActivityAction.Created,
            MEDICATION_SUMMARIES.created(formatMedicationLabel(input)),
            ctx.auth.user.id,
          ),
        ]);
        return created;
      } catch (error) {
        return rethrowDuplicate(error, E.duplicateMedication);
      }
    }),

  /**
   * Guarded on `expectedUpdatedAt`: the log row locks the medication at the
   * version the editor loaded, the update lands on that same version — both
   * or neither.
   */
  update: medicalWriterProcedure
    .input(medicationUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, expectedUpdatedAt, ...values } = input;
      const guard = and(
        eq(medications.id, id),
        medicationVersionMatches(expectedUpdatedAt),
      );

      let updated;
      try {
        [, [updated]] = await db.batch([
          medicationLog(
            id,
            ActivityAction.Updated,
            MEDICATION_SUMMARIES.updated(formatMedicationLabel(values)),
            ctx.auth.user.id,
            { table: medications, where: guard },
          ),
          db
            .update(medications)
            .set({
              ...values,
              nameKey: medicationNameKey(values.name, values.strength),
              updatedAt: new Date(),
            })
            .where(guard)
            .returning(medicationColumns),
        ]);
      } catch (error) {
        return rethrowDuplicate(error, E.duplicateMedication);
      }

      if (updated) return updated;
      // Nothing matched: gone, or changed since the editor loaded it.
      await readMedication(id);
      throw fail("CONFLICT", E.medicationChangedMeanwhile);
    }),

  /**
   * Soft hide, both ways. Never a delete: a pack may reference it, and the
   * catalogue keeps what was prescribed. A pack whose medication is
   * deactivated still loads, flagged «Médicament désactivé».
   */
  setActive: medicalWriterProcedure
    .input(medicationSetActiveSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await readMedication(input.id);
      const label = formatMedicationLabel(existing);
      const where = eq(medications.id, input.id);

      const [, [updated]] = await db.batch([
        medicationLog(
          input.id,
          ActivityAction.StatusChanged,
          input.isActive
            ? MEDICATION_SUMMARIES.reactivated(label)
            : MEDICATION_SUMMARIES.deactivated(label),
          ctx.auth.user.id,
          { table: medications, where },
        ),
        db
          .update(medications)
          .set({ isActive: input.isActive, updatedAt: new Date() })
          .where(where)
          .returning(medicationColumns),
      ]);
      if (!updated) throw fail("NOT_FOUND", E.medicationNotFound);
      return updated;
    }),
});

// ── Packs ───────────────────────────────────────────────────────────────────

/** Every pack (or one), with its items in order and each item's medication. */
const readPacks = async (packId?: string) => {
  const packs = await db
    .select({
      id: prescriptionPacks.id,
      name: prescriptionPacks.name,
      notes: prescriptionPacks.notes,
      updatedAt: prescriptionPacks.updatedAt,
    })
    .from(prescriptionPacks)
    .where(packId ? eq(prescriptionPacks.id, packId) : undefined)
    .orderBy(asc(sql`lower(${prescriptionPacks.name})`), asc(prescriptionPacks.id))
    .limit(PACKS_LIMIT);
  if (packs.length === 0) return [];

  const items = await db
    .select({
      id: prescriptionPackItems.id,
      packId: prescriptionPackItems.packId,
      medicationId: prescriptionPackItems.medicationId,
      posology: prescriptionPackItems.posology,
      duration: prescriptionPackItems.duration,
      remark: prescriptionPackItems.remark,
      position: prescriptionPackItems.position,
      // Inner join: the FK restricts, so every item has its medication — a
      // deactivated one included, flagged by `isActive`.
      medication: {
        name: medications.name,
        form: medications.form,
        strength: medications.strength,
        isActive: medications.isActive,
      },
    })
    .from(prescriptionPackItems)
    .innerJoin(medications, eq(prescriptionPackItems.medicationId, medications.id))
    .where(inArray(prescriptionPackItems.packId, packs.map((pack) => pack.id)))
    .orderBy(asc(prescriptionPackItems.position));

  return packs.map((pack) => ({
    ...pack,
    items: items.filter((item) => item.packId === pack.id),
  }));
};

const packItemRows = (packId: string, items: PackFormValues["items"]) =>
  items.map((item, position) => ({
    id: nanoid(),
    packId,
    medicationId: item.medicationId,
    posology: item.posology,
    duration: item.duration,
    remark: item.remark,
    position,
  }));

const packLog = (
  id: string,
  action: ActivityAction,
  summary: string,
  staffId: string,
  guard?: Parameters<typeof logActivity>[1],
) =>
  logActivity(
    {
      entityType: ActivityEntityType.PrescriptionPack,
      entityId: id,
      action,
      patientId: null,
      summary,
      staffId,
    },
    guard,
  );

/** A duplicate name, a vanished medication or a vanished pack, in French. */
const rethrowPackError = (error: unknown): never => {
  if (isUniqueViolation(error)) throw fail("CONFLICT", E.duplicatePack);
  const pg = pgError(error);
  if (pg?.code === FOREIGN_KEY_VIOLATION) {
    throw pg.constraint.includes("pack_id")
      ? fail("NOT_FOUND", E.packNotFound)
      : fail("BAD_REQUEST", E.packMedicationMissing);
  }
  throw error;
};

const readPackOrThrow = async (id: string) => {
  const [pack] = await readPacks(id);
  if (!pack) throw fail("NOT_FOUND", E.packNotFound);
  return pack;
};

export const prescriptionPacksRouter = createTRPCRouter({
  /** Every pack with its items — capped; a clinic keeps a handful. */
  getMany: protectedProcedure.query(() => readPacks()),

  getOne: protectedProcedure
    .input(packIdSchema)
    .query(({ input }) => readPackOrThrow(input.id)),

  create: medicalWriterProcedure
    .input(packFormSchema)
    .mutation(async ({ input, ctx }) => {
      const id = nanoid();
      try {
        await db.batch([
          db
            .insert(prescriptionPacks)
            .values({ id, name: input.name, notes: input.notes }),
          db.insert(prescriptionPackItems).values(packItemRows(id, input.items)),
          packLog(
            id,
            ActivityAction.Created,
            PRESCRIPTION_PACK_SUMMARIES.created(input.name),
            ctx.auth.user.id,
          ),
        ]);
      } catch (error) {
        return rethrowPackError(error);
      }
      return { id };
    }),

  /**
   * The items are REPLACED atomically: the pack's row, the delete of its old
   * items, the insert of the new ones and the log line form one batch. A
   * pack deleted meanwhile makes the insert fail on its foreign key, and the
   * whole batch rolls back.
   */
  update: medicalWriterProcedure
    .input(packUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      await readPackOrThrow(input.id);
      try {
        await db.batch([
          db
            .update(prescriptionPacks)
            .set({ name: input.name, notes: input.notes, updatedAt: new Date() })
            .where(eq(prescriptionPacks.id, input.id)),
          db
            .delete(prescriptionPackItems)
            .where(eq(prescriptionPackItems.packId, input.id)),
          db
            .insert(prescriptionPackItems)
            .values(packItemRows(input.id, input.items)),
          packLog(
            input.id,
            ActivityAction.Updated,
            PRESCRIPTION_PACK_SUMMARIES.updated(input.name),
            ctx.auth.user.id,
          ),
        ]);
      } catch (error) {
        return rethrowPackError(error);
      }
      return { id: input.id };
    }),

  /**
   * The pack and its items go (cascade); the medications stay, and no
   * issued ordonnance changes — its lines are copies.
   */
  remove: medicalWriterProcedure
    .input(packIdSchema)
    .mutation(async ({ input, ctx }) => {
      const pack = await readPackOrThrow(input.id);
      const where = eq(prescriptionPacks.id, input.id);
      const [, [removed]] = await db.batch([
        packLog(
          input.id,
          ActivityAction.Deleted,
          PRESCRIPTION_PACK_SUMMARIES.removed(pack.name),
          ctx.auth.user.id,
          { table: prescriptionPacks, where },
        ),
        db
          .delete(prescriptionPacks)
          .where(where)
          .returning({ id: prescriptionPacks.id }),
      ]);
      if (!removed) throw fail("NOT_FOUND", E.packNotFound);
      return removed;
    }),
});
