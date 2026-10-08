import "server-only";

import { TRPCError } from "@trpc/server";
import { addMonths, startOfMonth } from "date-fns";
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/database";
import {
  paidInRange,
  receivablesColumns,
  revenueColumns,
} from "@/database/sql/receivables";
import {
  activityLog,
  insurers,
  patients,
  payments,
  treatments,
  user,
} from "@/database/schema";
import { formatDH } from "@/lib/format";
import {
  clinicInstant,
  clinicNow,
  isCalendarDate,
  previousCalendarDate,
  startOfNextClinicDay,
  toClinicDate,
} from "@/lib/time";
import { formatPatientName } from "@/modules/patients/derived";
import {
  amountPaidCents as patientAmountPaidCents,
  remainingCents as patientRemainingCents,
  totalAmountCents as patientTotalAmountCents,
} from "@/modules/patients/server/procedures";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import {
  PATIENT_PAYMENTS_LIMIT,
  PAYMENT_ACTIVITY,
  PAYMENT_SERVER_ERRORS as E,
} from "../constants";
import { resolvePaidAt } from "../form-values";
import {
  advanceExcessCents,
  canEditPayment,
  needsAdvanceConfirmation,
} from "../rules";
import {
  paymentCreateSchema,
  paymentGetManySchema,
  paymentIdSchema,
  paymentsByPatientSchema,
  paymentSummarySchema,
  paymentUpdateSchema,
  type PaymentValues,
} from "../schemas";

/**
 * The clinic's payments. Reads are `protectedProcedure` with no staff scoping
 * — every staff member sees the whole clinic (AGENTS.md §2) — except the
 * admin totals; `remove` is admin; `update` is the admin or the creator on
 * the same clinic day.
 *
 * Payments land on the PATIENT account (08-clinical.md §3). `treatmentId` is
 * an optional allocation; the patient's `remainingCents` is the real number,
 * read through the patients slice's own SQL so every screen agrees.
 *
 * Every write lands with its `activityLog` row in ONE `db.batch` — one Neon
 * HTTP transaction. A deleted payment leaves a trail with its amount.
 */

const ENTITY_TYPE = "payment";

// ── Row shape ───────────────────────────────────────────────────────────────

/** One row shape for the list, the dossier tab and `getOne`. */
const selectPayments = () =>
  db
    .select({
      ...getTableColumns(payments),
      patient: {
        id: patients.id,
        shortCode: patients.shortCode,
        firstName: patients.firstName,
        lastName: patients.lastName,
        isArchived: patients.isArchived,
        insurerId: patients.insurerId,
      },
      insurer: {
        id: insurers.id,
        name: insurers.name,
        isActive: insurers.isActive,
      },
      // The allocated acte's label — its own snapshot, never the catalogue's.
      treatment: {
        id: treatments.id,
        label: treatments.label,
        nomenclatureCode: treatments.nomenclatureCode,
      },
      // Audit, shown as «saisi par». Joined, never used as a filter.
      createdByStaff: { id: user.id, name: user.name },
    })
    .from(payments)
    .innerJoin(patients, eq(payments.patientId, patients.id))
    .leftJoin(insurers, eq(payments.insurerId, insurers.id))
    .leftJoin(treatments, eq(payments.treatmentId, treatments.id))
    .leftJoin(user, eq(payments.createdByStaffId, user.id));

type PaymentRow = Awaited<ReturnType<typeof selectPayments>>[number];

interface Viewer {
  id: string;
  role?: string | null;
}

/**
 * The same test as `adminProcedure` (src/trpc/init.ts). Not ADMIN_ROLE from
 * the dashboard constants: that module carries the sidebar's icons.
 */
const isAdmin = (viewer: Viewer) => viewer.role === "admin";

/**
 * `canEdit` is decided here, from the same rule `update` enforces, so the
 * «Modifier» item is shown exactly when the server would accept it. Cosmetic
 * still: `update` re-checks.
 */
const withPermission = (viewer: Viewer, now: Date) => (row: PaymentRow) => ({
  ...row,
  canEdit: canEditPayment({
    isAdmin: isAdmin(viewer),
    staffId: viewer.id,
    createdByStaffId: row.createdByStaffId,
    createdAt: row.createdAt,
    now,
  }),
});

/** Newest first; the id keeps pages stable (05-slice.md §5 rule 4). */
const PAYMENT_LIST_ORDER = [desc(payments.paidAt), desc(payments.id)] as const;

/** Escapes the ILIKE wildcards so a typed "%" matches a literal per cent sign. */
const likePattern = (search: string) =>
  `%${search.replace(/[\\%_]/g, "\\$&")}%`;

const notFound = () => new TRPCError({ code: "NOT_FOUND", message: E.notFound });
const badRequest = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });
const conflict = () =>
  new TRPCError({ code: "CONFLICT", message: E.changedMeanwhile });

/**
 * `paidAt` within clinic calendar days; a malformed bound is ignored. The
 * predicate itself is the shared one (`src/database/sql/receivables.ts`).
 */
const paidWithin = (from: string, to: string) =>
  paidInRange({
    start: isCalendarDate(from) ? clinicInstant(from) : undefined,
    end: isCalendarDate(to) ? startOfNextClinicDay(to) : undefined,
  });

// ── Balance ─────────────────────────────────────────────────────────────────

/**
 * The patient and their balance, through the SAME SQL as `patients.getOne`
 * (billable actes only, payments summed, never clamped). This is what the
 * overpayment check reads — the client never supplies a balance.
 */
const readPatientBalance = async (patientId: string) => {
  const [row] = await db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      totalAmountCents: patientTotalAmountCents,
      amountPaidCents: patientAmountPaidCents,
      remainingCents: patientRemainingCents,
    })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  return row ?? null;
};

// ── Write rules ─────────────────────────────────────────────────────────────

interface ExistingLinks {
  insurerId: string | null;
}

/**
 * Every reference the payment names, checked side by side; returns the
 * patient with their current balance. Archived patients are accepted: a debt
 * must stay settleable (rule 5). On update an unchanged insurer is kept even
 * if since deactivated — the payment is history.
 */
const assertReferences = async (
  input: PaymentValues,
  existing?: ExistingLinks,
) => {
  const keepInsurer = existing && existing.insurerId === input.insurerId;

  const [patient, treatment, insurer] = await Promise.all([
    readPatientBalance(input.patientId),
    input.treatmentId
      ? db
          .select({ patientId: treatments.patientId })
          .from(treatments)
          .where(eq(treatments.id, input.treatmentId))
          .limit(1)
      : null,
    input.insurerId && !keepInsurer
      ? db
          .select({ id: insurers.id })
          .from(insurers)
          .where(
            and(eq(insurers.id, input.insurerId), eq(insurers.isActive, true)),
          )
          .limit(1)
      : null,
  ]);

  if (!patient) {
    throw new TRPCError({ code: "NOT_FOUND", message: E.patientNotFound });
  }
  if (treatment && treatment[0]?.patientId !== input.patientId) {
    throw badRequest(E.treatmentMismatch);
  }
  if (insurer && insurer.length === 0) throw badRequest(E.insurerUnavailable);

  return patient;
};

/** The columns a create or an update writes — the input never spreads raw. */
const writableValues = (input: PaymentValues) => ({
  treatmentId: input.treatmentId,
  insurerId: input.insurerId,
  amountCents: input.amountCents,
  method: input.method,
  paidAt: resolvePaidAt(input),
  reference: input.reference,
  notes: input.notes,
});

/**
 * Optimistic concurrency, as for actes: `updated_at` is microsecond
 * precision, the client's token a millisecond Date — the column is truncated
 * to the token's precision so the comparison is exact.
 */
const versionMatches = (version: Date) =>
  sql`date_trunc('milliseconds', ${payments.updatedAt}) = ${version.toISOString()}::timestamp`;

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

// ── Patient-scoped serialization ────────────────────────────────────────────
//
// Two staff members encaissing the same patient at once both read «reste
// 1 000 DH», both pay 1 000 DH unconfirmed, and the patient ends 1 000 DH in
// credit that nobody confirmed. A lock on the PAYMENT row cannot prevent
// that: the two writes touch different payments. The boundary is the
// PATIENT.
//
// Neon HTTP has no interactive transaction, so read → check → write cannot
// span round trips. Instead the guarded writes are one `db.batch` (one
// transaction) whose FIRST statement locks the patient row `FOR UPDATE`.
// Every guarded write for that patient queues on it. Under READ COMMITTED
// each later statement takes a fresh snapshot AFTER the lock is granted, so
// the write's own WHERE re-reads the balance — including a payment
// committed by whoever held the lock before — and refuses to land if the
// advance was not confirmed. The pre-check in JS is only the fast path that
// answers `needs_confirmation` without taking a lock.

/** Batch statement 1: the patient row, locked until the batch commits. */
const lockPatient = (patientId: string) =>
  db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.id, patientId))
    .for("update");

/**
 * The write may land: the SQL mirror of `needsAdvanceConfirmation`
 * (rules.ts, covered by Vitest) — confirmed, or not raising the amount, or
 * leaving the balance ≥ 0. Evaluated inside the write statement, against the
 * balance as of the lock (the patients slice's own SQL). `previous` is the
 * stored amount on update — the column itself, read in the same statement —
 * and 0 on create.
 */
const advanceAllowed = ({
  confirmed,
  amountCents,
  previous,
}: {
  confirmed: boolean;
  amountCents: number;
  previous: SQL | number;
}) =>
  confirmed
    ? sql`TRUE`
    : sql`(${amountCents}::int <= ${previous} OR ${patientRemainingCents} + ${previous} - ${amountCents}::int >= 0)`;

/** How many times a write refused by the guard re-reads and decides again. */
const MAX_GUARDED_ATTEMPTS = 3;

/** The write-free answer: nothing was written, ask the staff member. */
const needsConfirmation = (check: {
  remainingCents: number;
  amountCents: number;
  previousAmountCents?: number;
}) => ({
  status: "needs_confirmation" as const,
  remainingCents: check.remainingCents,
  excessCents: advanceExcessCents(check),
  payment: null,
});

/**
 * The activity row as INSERT … SELECT from the payment itself, `FOR UPDATE`:
 * written only if the payment is at `version`. After a create or an update it
 * follows the write and keys on the version that write stamped, so it lands
 * exactly when the write did. Before a remove it locks the row, so the delete
 * that follows cannot miss. Either both land, or neither.
 */
const logFromPayment = (
  id: string,
  version: Date,
  entry: { action: string; summary: string; staffId: string },
) =>
  db.insert(activityLog).select(
    db
      .select({
        id: sql<string>`${nanoid()}::text`.as("id"),
        entityType: sql<string>`${ENTITY_TYPE}::text`.as("entity_type"),
        entityId: payments.id,
        action: sql<string>`${entry.action}::text`.as("action"),
        summary: sql<string>`${entry.summary}::text`.as("summary"),
        staffId: sql<string>`${entry.staffId}::text`.as("staff_id"),
        createdAt: sql<Date>`now()`.as("created_at"),
      })
      .from(payments)
      .where(and(eq(payments.id, id), versionMatches(version)))
      .for("update"),
  );

/** The stored payment the update and remove rules read. */
const readExisting = async (id: string) => {
  const [row] = await db
    .select({
      patientId: payments.patientId,
      amountCents: payments.amountCents,
      insurerId: payments.insurerId,
      createdByStaffId: payments.createdByStaffId,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
      patient: { firstName: patients.firstName, lastName: patients.lastName },
    })
    .from(payments)
    .innerJoin(patients, eq(payments.patientId, patients.id))
    .where(eq(payments.id, id))
    .limit(1);
  if (!row) throw notFound();
  return row;
};

/** Nothing matched: deleted meanwhile, or saved by someone else first. */
const notFoundOrConflict = async (id: string): Promise<never> => {
  const [still] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.id, id))
    .limit(1);
  throw still ? conflict() : notFound();
};

const loadOne = async (id: string, viewer: Viewer) => {
  const [row] = await selectPayments().where(eq(payments.id, id));
  if (!row) throw notFound();
  return withPermission(viewer, new Date())(row);
};

// ── Router ──────────────────────────────────────────────────────────────────

export const paymentsRouter = createTRPCRouter({
  /** `/paiements`, a page at a time. */
  getMany: protectedProcedure
    .input(paymentGetManySchema)
    .query(async ({ input, ctx }) => {
      const { page, pageSize, method, insurerId, from, to } = input;
      const search = input.search?.trim();

      // ONE predicate for the page and the count (05-slice.md §5 rule 6).
      // Clinic-day bounds go through TZDate — never a hardcoded offset.
      const where = and(
        search
          ? or(
              ilike(payments.reference, likePattern(search)),
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
        method ? eq(payments.method, method) : undefined,
        insurerId ? eq(payments.insurerId, insurerId) : undefined,
        paidWithin(from, to),
      );

      const [rows, [totals]] = await Promise.all([
        selectPayments()
          .where(where)
          .orderBy(...PAYMENT_LIST_ORDER)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: count() })
          .from(payments)
          .innerJoin(patients, eq(payments.patientId, patients.id))
          .where(where),
      ]);

      return {
        items: rows.map(withPermission(ctx.auth.user, new Date())),
        total: totals.count,
        totalPages: Math.ceil(totals.count / pageSize),
      };
    }),

  /**
   * The dossier's «Paiements» tab: the same row shape, newest first, capped
   * at `PATIENT_PAYMENTS_LIMIT`. `total` lets the tab say when the cap hides
   * older ones.
   */
  getManyByPatient: protectedProcedure
    .input(paymentsByPatientSchema)
    .query(async ({ input, ctx }) => {
      const where = eq(payments.patientId, input.patientId);
      const [rows, [totals]] = await Promise.all([
        selectPayments()
          .where(where)
          .orderBy(...PAYMENT_LIST_ORDER)
          .limit(PATIENT_PAYMENTS_LIMIT),
        db.select({ count: count() }).from(payments).where(where),
      ]);

      return {
        items: rows.map(withPermission(ctx.auth.user, new Date())),
        total: totals.count,
        totalPages: 1,
      };
    }),

  getOne: protectedProcedure
    .input(paymentIdSchema)
    .query(({ input, ctx }) => loadOne(input.id, ctx.auth.user)),

  /**
   * The admin header. The reception must not read the takings off the
   * screen, so the totals are refused HERE, not only hidden (rule 4).
   *
   * - collected / count: payments whose `paidAt` falls in the period
   *   (default: the current month on the clinic's calendar);
   * - outstanding: SUM over patients of GREATEST(remaining, 0) — one
   *   patient's advance never hides another's debt;
   * - advances: the credits, summed apart.
   *
   * Outstanding and advances are balances as of now, not period figures.
   */
  getSummary: adminProcedure
    .input(paymentSummarySchema)
    .query(async ({ input }) => {
      const isDefault = !isCalendarDate(input.from) && !isCalendarDate(input.to);
      let from = input.from;
      let to = input.to;
      if (isDefault) {
        const monthStart = startOfMonth(clinicNow());
        from = toClinicDate(monthStart);
        to = previousCalendarDate(toClinicDate(addMonths(monthStart, 1)));
      }

      // The SAME fragments as `dashboard.getAdminStats` — one definition of
      // revenue and of the balances (src/database/sql/receivables.ts).
      const [[collected], [balances]] = await Promise.all([
        db
          .select(revenueColumns)
          .from(payments)
          .where(paidWithin(from, to)),
        db.select(receivablesColumns(patientRemainingCents)).from(patients),
      ]);

      return {
        totalCollectedCents: collected.revenueCents,
        paymentCount: collected.paymentCount,
        outstandingCents: balances.outstandingCents,
        advancesCents: balances.advancesCents,
        period: {
          from: isCalendarDate(from) ? from : "",
          to: isCalendarDate(to) ? to : "",
          isCurrentMonth: isDefault,
        },
      };
    }),

  /**
   * Any staff member may encaisser. A payment that would put the patient in
   * credit is answered `needs_confirmation` and NOTHING is written until the
   * staff member resubmits with `confirmAdvance`.
   *
   * The balance check and the insert share the patient lock (see «Patient-
   * scoped serialization»): the insert is INSERT … SELECT FROM patients WHERE
   * `advanceAllowed`, so a concurrent payment cannot slip an unconfirmed
   * advance past it. A refused insert writes nothing — nor its log row — and
   * the balance is re-read and decided again.
   */
  create: protectedProcedure
    .input(paymentCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const patient = await assertReferences(input);
      const values = writableValues(input);
      const summary = PAYMENT_ACTIVITY.created(
        formatPatientName(patient),
        formatDH(input.amountCents),
      );
      let remainingCents = patient.remainingCents;

      for (let attempt = 1; attempt <= MAX_GUARDED_ATTEMPTS; attempt++) {
        const check = { remainingCents, amountCents: input.amountCents };
        // Fast path: no lock taken, nothing written.
        if (!input.confirmAdvance && needsAdvanceConfirmation(check)) {
          return needsConfirmation(check);
        }

        // Stamped here, at the millisecond precision the version token
        // travels in. Sent as ISO strings: a bare Date parameter would be
        // serialised in the server's local zone and `::timestamp` would keep
        // that wall clock.
        const stamp = new Date();
        const at = stamp.toISOString();
        const id = nanoid();

        try {
          const [, [created]] = await db.batch([
            lockPatient(input.patientId),
            // The columns in table order, as INSERT … SELECT requires.
            db
              .insert(payments)
              .select(
                db
                  .select({
                    id: sql<string>`${id}::text`.as("id"),
                    patientId: patients.id,
                    treatmentId: sql<string | null>`${values.treatmentId}::text`.as("treatment_id"),
                    insurerId: sql<string | null>`${values.insurerId}::text`.as("insurer_id"),
                    amountCents: sql<number>`${values.amountCents}::int`.as("amount_cents"),
                    method: sql<string>`${values.method}::payment_method`.as("method"),
                    paidAt: sql<Date>`${values.paidAt.toISOString()}::timestamptz`.as("paid_at"),
                    reference: sql<string | null>`${values.reference}::text`.as("reference"),
                    notes: sql<string | null>`${values.notes}::text`.as("notes"),
                    // Audit only, from the session — never read as a filter
                    // (AGENTS.md §2).
                    createdByStaffId: sql<string>`${ctx.auth.user.id}::text`.as("created_by_staff_id"),
                    createdAt: sql<Date>`${at}::timestamp`.as("created_at"),
                    updatedAt: sql<Date>`${at}::timestamp`.as("updated_at"),
                  })
                  .from(patients)
                  .where(
                    and(
                      eq(patients.id, input.patientId),
                      advanceAllowed({
                        confirmed: input.confirmAdvance,
                        amountCents: input.amountCents,
                        previous: 0,
                      }),
                    ),
                  ),
              )
              .returning(),
            logFromPayment(id, stamp, {
              action: "created",
              summary,
              staffId: ctx.auth.user.id,
            }),
          ]);

          if (created) return { status: "saved" as const, payment: created };
        } catch (error) {
          return rethrowWriteError(error);
        }

        // Refused by the guard: a payment committed meanwhile moved the
        // balance. Re-read it, decide again.
        const fresh = await readPatientBalance(input.patientId);
        if (!fresh) {
          throw new TRPCError({ code: "NOT_FOUND", message: E.patientNotFound });
        }
        remainingCents = fresh.remainingCents;
      }

      return needsConfirmation({ remainingCents, amountCents: input.amountCents });
    }),

  /**
   * The admin, or the creator on the same clinic day. `patientId` is
   * immutable. The write is conditional on `expectedUpdatedAt`, the version
   * the editor loaded; the advance check counts this payment's stored amount
   * out of the balance before counting the new one in.
   *
   * Same patient boundary as `create`: the UPDATE carries the version guard
   * AND `advanceAllowed`, after the patient lock. Zero rows means one of
   * three things, told apart by re-reading: deleted (NOT_FOUND), saved by
   * someone else (CONFLICT), or refused by the guard (re-decide).
   */
  update: protectedProcedure
    .input(paymentUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await readExisting(input.id);

      if (
        !canEditPayment({
          isAdmin: isAdmin(ctx.auth.user),
          staffId: ctx.auth.user.id,
          createdByStaffId: existing.createdByStaffId,
          createdAt: existing.createdAt,
        })
      ) {
        throw new TRPCError({ code: "FORBIDDEN", message: E.editForbidden });
      }
      if (input.patientId !== existing.patientId) {
        throw badRequest(E.patientImmutable);
      }
      if (existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
        throw conflict();
      }

      const patient = await assertReferences(input, existing);
      const values = writableValues(input);
      const summary = PAYMENT_ACTIVITY.updated(
        formatPatientName(existing.patient),
        formatDH(existing.amountCents),
        formatDH(input.amountCents),
      );
      let remainingCents = patient.remainingCents;

      for (let attempt = 1; attempt <= MAX_GUARDED_ATTEMPTS; attempt++) {
        const check = {
          remainingCents,
          amountCents: input.amountCents,
          previousAmountCents: existing.amountCents,
        };
        // Fast path: no lock taken, nothing written.
        if (!input.confirmAdvance && needsAdvanceConfirmation(check)) {
          return needsConfirmation(check);
        }

        const stamp = new Date();
        try {
          const [, [updated]] = await db.batch([
            lockPatient(input.patientId),
            db
              .update(payments)
              .set({ ...values, updatedAt: stamp })
              .from(patients)
              .where(
                and(
                  eq(payments.id, input.id),
                  versionMatches(input.expectedUpdatedAt),
                  eq(patients.id, payments.patientId),
                  advanceAllowed({
                    confirmed: input.confirmAdvance,
                    amountCents: input.amountCents,
                    previous: sql`${payments.amountCents}`,
                  }),
                ),
              )
              .returning(getTableColumns(payments)),
            // Keyed on the version the update just stamped: logged exactly
            // when the update landed.
            logFromPayment(input.id, stamp, {
              action: "updated",
              summary,
              staffId: ctx.auth.user.id,
            }),
          ]);

          if (updated) return { status: "saved" as const, payment: updated };
        } catch (error) {
          return rethrowWriteError(error);
        }

        // Nothing matched: deleted, saved by someone else, or the guard.
        const [current] = await db
          .select({ updatedAt: payments.updatedAt })
          .from(payments)
          .where(eq(payments.id, input.id))
          .limit(1);
        if (!current) throw notFound();
        if (current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
          throw conflict();
        }
        const fresh = await readPatientBalance(input.patientId);
        if (!fresh) throw notFound();
        remainingCents = fresh.remainingCents;
      }

      return needsConfirmation({
        remainingCents,
        amountCents: input.amountCents,
        previousAmountCents: existing.amountCents,
      });
    }),

  // DESTRUCTIVE ⇒ admin, and the rejection comes from here, never from a
  // hidden button (AGENTS.md §2).
  remove: adminProcedure
    .input(paymentIdSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await readExisting(input.id);

      const [, [removed]] = await db.batch([
        logFromPayment(input.id, existing.updatedAt, {
          action: "deleted",
          summary: PAYMENT_ACTIVITY.removed(
            formatPatientName(existing.patient),
            formatDH(existing.amountCents),
            formatDH(0),
          ),
          staffId: ctx.auth.user.id,
        }),
        db
          .delete(payments)
          .where(
            and(eq(payments.id, input.id), versionMatches(existing.updatedAt)),
          )
          .returning({ id: payments.id }),
      ]);

      if (removed) return removed;
      return notFoundOrConflict(input.id);
    }),
});
