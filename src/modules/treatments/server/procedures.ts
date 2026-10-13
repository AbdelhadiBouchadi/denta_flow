import "server-only";

import { TRPCError } from "@trpc/server";
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  ilike,
  inArray,
  lt,
  or,
  sql,
  sum,
  type SQL,
} from "drizzle-orm";
import { nanoid } from "nanoid";

import { PRACTITIONER_ROLES } from "@/constants";
import { db } from "@/database";
import {
  appointments,
  patients,
  payments,
  services,
  treatments,
  user,
} from "@/database/schema";
import { isBillableTreatment } from "@/database/sql/billable";
import { treatmentDate } from "@/database/sql/treatment-date";
import {
  clinicInstant,
  isCalendarDate,
  startOfNextClinicDay,
} from "@/lib/time";
import { logActivity } from "@/modules/activity/server/log";
import { TREATMENT_SUMMARIES } from "@/modules/activity/summaries";
import { ActivityAction, ActivityEntityType } from "@/modules/activity/types";
import { formatPatientName } from "@/modules/patients/derived";
import { getNgapAct } from "@/modules/services/ngap";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import {
  PATIENT_TREATMENTS_LIMIT,
  TREATMENT_SERVER_ERRORS as E,
} from "../constants";
import { resolvePerformedAt } from "../form-values";
import {
  ngapLookupSchema,
  treatmentFormSchema,
  treatmentGetManySchema,
  treatmentIdSchema,
  treatmentsByPatientSchema,
  treatmentUpdateSchema,
  type TreatmentValues,
} from "../schemas";
import type { TreatmentStatus } from "../types";
import { archivedPatientBlocksWrite } from "./archived-guard";

/**
 * The clinic's actes. Reads are `protectedProcedure` with no staff scoping —
 * every staff member sees the whole clinic (AGENTS.md §2); `remove` is the one
 * `adminProcedure`.
 *
 * `label`, `nomenclatureCode` and `totalAmountCents` are SNAPSHOTS taken when
 * the acte is recorded: repricing or recoding a service never rewrites an
 * existing acte (08-clinical.md §3).
 */

// ── Derived figures ─────────────────────────────────────────────────────────
// Computed by Postgres and cast to int; never stored (08-clinical.md §3).
// Built with the query builder so the subquery's own WHERE stays fully
// qualified (see the patients procedures for why a raw string is unsafe).

/**
 * Payments ALLOCATED to this acte (`treatmentId`). Allocation is optional, so
 * this is not the patient's balance — the dossier strip is.
 */
const amountPaidCents = sql<number>`COALESCE(${db
  .select({ value: sum(payments.amountCents) })
  .from(payments)
  .where(eq(payments.treatmentId, treatments.id))}, 0)::int`;

/**
 * What this acte puts on the bill: its amount when billable (the shared rule,
 * src/database/sql/billable.ts), 0 for a plan or a cancelled acte.
 */
const amountDueCents = sql<number>`(CASE WHEN ${isBillableTreatment} THEN ${treatments.totalAmountCents} ELSE 0 END)::int`;

/** May be negative (an «Avance» on this acte). Never clamped. */
const remainingCents = sql<number>`(${amountDueCents} - ${amountPaidCents})::int`;

/**
 * The date an acte is listed, filtered and sorted by: when it was performed,
 * else when it was recorded — the shared definition, so `/statistiques` dates
 * «Production» exactly as this list does (src/database/sql/treatment-date.ts).
 */
const listedAt = treatmentDate;

/** One row shape for the list, the dossier tab and `getOne`. */
const selectTreatments = () =>
  db
    .select({
      ...getTableColumns(treatments),
      listedAt,
      amountDueCents,
      amountPaidCents,
      remainingCents,
      patient: {
        id: patients.id,
        shortCode: patients.shortCode,
        firstName: patients.firstName,
        lastName: patients.lastName,
        isArchived: patients.isArchived,
      },
      // A summary: the `user` row also holds auth fields.
      practitioner: { id: user.id, name: user.name },
      // The catalogue entry as it is NOW — the form keeps an unchanged,
      // since-deactivated service selectable. Never the acte's price.
      service: {
        id: services.id,
        label: services.label,
        isActive: services.isActive,
      },
    })
    .from(treatments)
    .innerJoin(patients, eq(treatments.patientId, patients.id))
    .leftJoin(user, eq(treatments.practitionerId, user.id))
    .leftJoin(services, eq(treatments.serviceId, services.id));

type TreatmentRow = Awaited<ReturnType<typeof selectTreatments>>[number];

/** The NGAP reference details, looked up from the code — never stored. */
const ngapOf = (code: string | null | undefined) => {
  const act = getNgapAct(code);
  return act
    ? {
        letter: act.letter,
        coefficient: act.coefficient,
        referenceTariffCents: act.referenceTariffCents,
        onQuote: act.onQuote === true,
        xrayRequired: act.xrayRequired,
      }
    : null;
};

const withNgap = (row: TreatmentRow) => ({
  ...row,
  ngap: ngapOf(row.nomenclatureCode),
});

/** Newest first; the id keeps pages stable (05-slice.md §5 rule 4). */
const TREATMENT_LIST_ORDER = [desc(listedAt), desc(treatments.id)] as const;

/** Escapes the ILIKE wildcards so a typed "%" matches a literal per cent sign. */
const likePattern = (search: string) =>
  `%${search.replace(/[\\%_]/g, "\\$&")}%`;

const notFound = () => new TRPCError({ code: "NOT_FOUND", message: E.notFound });
const badRequest = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });

// ── Write rules ─────────────────────────────────────────────────────────────

interface ExistingLinks {
  patientId: string;
  practitionerId: string | null;
  serviceId: string | null;
}

/**
 * Every reference the acte names, checked side by side. On update, an
 * unchanged patient (even archived), practitioner or service (even since
 * deactivated) is kept — the acte is history, and correcting it must not fail
 * on it. Returns the patient's display name, for the activity line.
 */
const assertReferences = async (
  input: TreatmentValues,
  existing?: ExistingLinks,
) => {
  const keepPractitioner =
    existing && existing.practitionerId === input.practitionerId;
  const keepService = existing && existing.serviceId === input.serviceId;

  const [[patient], practitioner, service, appointment] = await Promise.all([
    db
      .select({
        isArchived: patients.isArchived,
        firstName: patients.firstName,
        lastName: patients.lastName,
      })
      .from(patients)
      .where(eq(patients.id, input.patientId))
      .limit(1),
    input.practitionerId && !keepPractitioner
      ? db
          .select({ id: user.id })
          .from(user)
          .where(
            and(
              eq(user.id, input.practitionerId),
              eq(user.isActive, true),
              inArray(user.role, [...PRACTITIONER_ROLES]),
            ),
          )
          .limit(1)
      : null,
    input.serviceId && !keepService
      ? db
          .select({ id: services.id })
          .from(services)
          .where(
            and(eq(services.id, input.serviceId), eq(services.isActive, true)),
          )
          .limit(1)
      : null,
    input.appointmentId
      ? db
          .select({ patientId: appointments.patientId })
          .from(appointments)
          .where(eq(appointments.id, input.appointmentId))
          .limit(1)
      : null,
  ]);

  if (!patient) {
    throw new TRPCError({ code: "NOT_FOUND", message: E.patientNotFound });
  }
  if (
    archivedPatientBlocksWrite({
      targetIsArchived: patient.isArchived,
      targetPatientId: input.patientId,
      existingPatientId: existing?.patientId,
    })
  ) {
    throw badRequest(E.patientArchived);
  }
  if (practitioner && practitioner.length === 0) {
    throw badRequest(E.practitionerInvalid);
  }
  if (service && service.length === 0) throw badRequest(E.serviceUnavailable);
  if (appointment && appointment[0]?.patientId !== input.patientId) {
    throw badRequest(E.appointmentMismatch);
  }

  // The name the activity line prints.
  return formatPatientName(patient);
};

/** The columns a create or an update writes — the input never spreads raw. */
const writableValues = (input: TreatmentValues) => ({
  patientId: input.patientId,
  serviceId: input.serviceId,
  practitionerId: input.practitionerId,
  appointmentId: input.appointmentId,
  label: input.label,
  nomenclatureCode: input.nomenclatureCode,
  teeth: input.teeth,
  totalAmountCents: input.totalAmountCents,
  status: input.status,
  performedAt: resolvePerformedAt(input),
  notes: input.notes,
});

/** drizzle wraps driver errors; the Postgres code sits on `cause`. */
const FOREIGN_KEY_VIOLATION = "23503";
const isForeignKeyViolation = (error: unknown) => {
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    if ((current as Error & { code?: unknown }).code === FOREIGN_KEY_VIOLATION) {
      return true;
    }
    current = current.cause;
  }
  return false;
};

/** A reference deleted between the check and the write. No `cause`: it carries notes. */
const rethrowWriteError = (error: unknown): never => {
  if (error instanceof TRPCError) throw error;
  if (isForeignKeyViolation(error)) throw badRequest(E.missingReference);
  throw error;
};

/**
 * Optimistic concurrency, as for appointments: `updated_at` is microsecond
 * precision, the client's token a millisecond Date — the column is truncated
 * to the token's precision so the comparison is exact.
 */
const versionMatches = (expectedUpdatedAt: Date) =>
  sql`date_trunc('milliseconds', ${treatments.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamp`;

/**
 * The acte's activity line, guarded on the row (`logActivity`'s guarded
 * form): placed BEFORE the write carrying the same precondition, it locks the
 * row, so the line and the write land together or not at all. No amount in
 * any acte line (prompts/27, decision 4).
 */
const logTreatment = (
  id: string,
  precondition: SQL | undefined,
  entry: {
    action: ActivityAction;
    patientId: string;
    summary: string;
    staffId: string;
  },
) =>
  logActivity(
    { entityType: ActivityEntityType.Treatment, entityId: id, ...entry },
    { table: treatments, where: and(eq(treatments.id, id), precondition) },
  );

const loadOne = async (id: string) => {
  const [row] = await selectTreatments().where(eq(treatments.id, id));
  if (!row) throw notFound();
  return withNgap(row);
};

// ── Router ──────────────────────────────────────────────────────────────────

export const treatmentsRouter = createTRPCRouter({
  /** `/actes`, a page at a time. */
  getMany: protectedProcedure
    .input(treatmentGetManySchema)
    .query(async ({ input }) => {
      const { page, pageSize, status, practitionerId, from, to } = input;
      const search = input.search?.trim();

      // ONE predicate for the page and the count (05-slice.md §5 rule 6).
      // Clinic-day bounds go through TZDate — never a hardcoded offset.
      const where = and(
        search
          ? or(
              ilike(treatments.label, likePattern(search)),
              ilike(treatments.nomenclatureCode, likePattern(search)),
              ilike(patients.shortCode, likePattern(search)),
              ilike(
                sql`${patients.lastName} || ' ' || ${patients.firstName}`,
                likePattern(search),
              ),
              ilike(
                sql`${patients.firstName} || ' ' || ${patients.lastName}`,
                likePattern(search),
              ),
            )
          : undefined,
        status ? eq(treatments.status, status) : undefined,
        practitionerId
          ? eq(treatments.practitionerId, practitionerId)
          : undefined,
        isCalendarDate(from) ? gte(listedAt, clinicInstant(from)) : undefined,
        isCalendarDate(to) ? lt(listedAt, startOfNextClinicDay(to)) : undefined,
      );

      const [rows, [totals]] = await Promise.all([
        selectTreatments()
          .where(where)
          .orderBy(...TREATMENT_LIST_ORDER)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: count() })
          .from(treatments)
          .innerJoin(patients, eq(treatments.patientId, patients.id))
          .where(where),
      ]);

      return {
        items: rows.map(withNgap),
        total: totals.count,
        totalPages: Math.ceil(totals.count / pageSize),
      };
    }),

  /**
   * The dossier's «Actes» tab: the same row shape, newest first, capped at
   * `PATIENT_TREATMENTS_LIMIT`. `total` lets the tab say when the cap hides
   * older ones.
   */
  getManyByPatient: protectedProcedure
    .input(treatmentsByPatientSchema)
    .query(async ({ input }) => {
      const where = eq(treatments.patientId, input.patientId);
      const [rows, [totals]] = await Promise.all([
        selectTreatments()
          .where(where)
          .orderBy(...TREATMENT_LIST_ORDER)
          .limit(PATIENT_TREATMENTS_LIMIT),
        db.select({ count: count() }).from(treatments).where(where),
      ]);

      return { items: rows.map(withNgap), total: totals.count, totalPages: 1 };
    }),

  getOne: protectedProcedure
    .input(treatmentIdSchema)
    .query(({ input }) => loadOne(input.id)),

  /**
   * The NGAP line of a code typed or snapshotted in the form. The dataset
   * stays on the server: no client imports ngap.ts or the JSON.
   */
  ngapLookup: protectedProcedure
    .input(ngapLookupSchema)
    .query(({ input }) => ngapOf(input.code)),

  create: protectedProcedure
    .input(treatmentFormSchema)
    .mutation(async ({ input, ctx }) => {
      const patient = await assertReferences(input);

      try {
        // Stamped here, at the millisecond precision the version token
        // travels in, not left to `defaultNow()`.
        const now = new Date();
        const id = nanoid();
        // One batch: a refused insert takes its line with it.
        const [[created]] = await db.batch([
          db
            .insert(treatments)
            .values({
              ...writableValues(input),
              id,
              createdAt: now,
              updatedAt: now,
              // Audit only, from the session — never read as a filter
              // (AGENTS.md §2).
              createdByStaffId: ctx.auth.user.id,
            })
            .returning({ id: treatments.id }),
          logActivity({
            entityType: ActivityEntityType.Treatment,
            entityId: id,
            action: ActivityAction.Created,
            patientId: input.patientId,
            summary: TREATMENT_SUMMARIES.created(
              patient,
              input.label,
              input.teeth,
            ),
            staffId: ctx.auth.user.id,
          }),
        ]);

        return created;
      } catch (error) {
        return rethrowWriteError(error);
      }
    }),

  /**
   * The write is conditional on `expectedUpdatedAt`, the version the editor
   * loaded. The read below only feeds the reference rules; it is never the
   * concurrency guard.
   */
  update: protectedProcedure
    .input(treatmentUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const [existing] = await db
        .select({
          patientId: treatments.patientId,
          practitionerId: treatments.practitionerId,
          serviceId: treatments.serviceId,
          status: treatments.status,
        })
        .from(treatments)
        .where(eq(treatments.id, input.id))
        .limit(1);

      if (!existing) throw notFound();
      const patient = await assertReferences(input, existing);

      // One line per save: a status move is the fact worth reading
      // («passé de Prévu à Réalisé»); anything else is «modifié».
      const from = existing.status as TreatmentStatus;
      const statusChanged = from !== input.status;
      const version = versionMatches(input.expectedUpdatedAt);

      try {
        const [, [updated]] = await db.batch([
          logTreatment(input.id, version, {
            action: statusChanged
              ? ActivityAction.StatusChanged
              : ActivityAction.Updated,
            patientId: input.patientId,
            summary: statusChanged
              ? TREATMENT_SUMMARIES.statusChanged(
                  patient,
                  input.label,
                  from,
                  input.status,
                )
              : TREATMENT_SUMMARIES.updated(patient, input.label),
            staffId: ctx.auth.user.id,
          }),
          db
            .update(treatments)
            .set({ ...writableValues(input), updatedAt: new Date() })
            .where(and(eq(treatments.id, input.id), version))
            .returning({ id: treatments.id }),
        ]);

        if (updated) return updated;
      } catch (error) {
        return rethrowWriteError(error);
      }

      // Nothing matched: deleted meanwhile, or saved by someone else first.
      const [still] = await db
        .select({ id: treatments.id })
        .from(treatments)
        .where(eq(treatments.id, input.id))
        .limit(1);
      if (!still) throw notFound();
      throw new TRPCError({
        code: "CONFLICT",
        message: E.treatmentChangedMeanwhile,
      });
    }),

  // DESTRUCTIVE ⇒ admin, and the rejection comes from here, never from a
  // hidden button (AGENTS.md §2).
  remove: adminProcedure
    .input(treatmentIdSchema)
    .mutation(async ({ input, ctx }) => {
      const [existing] = await db
        .select({
          patientId: treatments.patientId,
          label: treatments.label,
          teeth: treatments.teeth,
          // The version the line's patient, label and teeth were read at.
          updatedAt: treatments.updatedAt,
          patient: {
            firstName: patients.firstName,
            lastName: patients.lastName,
          },
        })
        .from(treatments)
        .innerJoin(patients, eq(treatments.patientId, patients.id))
        .where(eq(treatments.id, input.id))
        .limit(1);
      if (!existing) throw notFound();

      // The line locks the row, the DELETE then removes it: both or neither.
      // Both require the version read above, so an acte edited in between is
      // neither logged with stale details nor deleted: CONFLICT. Payments
      // allocated to it are kept: their FK is `set null`, so they fall back
      // to the patient account.
      const version = versionMatches(existing.updatedAt);
      const [, [removed]] = await db.batch([
        logTreatment(input.id, version, {
          action: ActivityAction.Deleted,
          patientId: existing.patientId,
          summary: TREATMENT_SUMMARIES.removed(
            formatPatientName(existing.patient),
            existing.label,
            existing.teeth,
          ),
          staffId: ctx.auth.user.id,
        }),
        db
          .delete(treatments)
          .where(and(eq(treatments.id, input.id), version))
          .returning({ id: treatments.id }),
      ]);

      if (removed) return removed;

      // Nothing matched: deleted meanwhile, or changed since it was read.
      const [still] = await db
        .select({ id: treatments.id })
        .from(treatments)
        .where(eq(treatments.id, input.id))
        .limit(1);
      if (!still) throw notFound();
      throw new TRPCError({
        code: "CONFLICT",
        message: E.treatmentChangedMeanwhile,
      });
    }),
});
