import "server-only";

import { TRPCError } from "@trpc/server";
import { addMonths, startOfMonth } from "date-fns";
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  ilike,
  lt,
  or,
  sql,
  sum,
} from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/database";
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

/** `paidAt` within clinic calendar days; a malformed bound is ignored. */
const paidWithin = (from: string, to: string) =>
  and(
    isCalendarDate(from) ? gte(payments.paidAt, clinicInstant(from)) : undefined,
    isCalendarDate(to) ? lt(payments.paidAt, startOfNextClinicDay(to)) : undefined,
  );

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

/**
 * The activity row for an update or a remove, as INSERT … SELECT from the
 * payment itself, `FOR UPDATE`: it is written only if the payment is still at
 * the version the request read, and it locks that row so the write that
 * follows in the same batch cannot miss. Either both land, or neither.
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

      const [[collected], [balances]] = await Promise.all([
        db
          .select({
            totalCollectedCents: sql<number>`COALESCE(${sum(payments.amountCents)}, 0)::int`,
            paymentCount: count(),
          })
          .from(payments)
          .where(paidWithin(from, to)),
        db
          .select({
            outstandingCents: sql<number>`COALESCE(SUM(GREATEST(${patientRemainingCents}, 0)), 0)::int`,
            advancesCents: sql<number>`COALESCE(SUM(GREATEST(-(${patientRemainingCents}), 0)), 0)::int`,
          })
          .from(patients),
      ]);

      return {
        totalCollectedCents: collected.totalCollectedCents,
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
   */
  create: protectedProcedure
    .input(paymentCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const patient = await assertReferences(input);

      const confirmation = {
        remainingCents: patient.remainingCents,
        amountCents: input.amountCents,
      };
      if (needsAdvanceConfirmation(confirmation) && !input.confirmAdvance) {
        return {
          status: "needs_confirmation" as const,
          remainingCents: patient.remainingCents,
          excessCents: advanceExcessCents(confirmation),
          payment: null,
        };
      }

      // Stamped here, at the millisecond precision the version token travels
      // in, not left to `defaultNow()`.
      const now = new Date();
      const id = nanoid();
      try {
        const [[created]] = await db.batch([
          db
            .insert(payments)
            .values({
              ...writableValues(input),
              id,
              patientId: input.patientId,
              createdAt: now,
              updatedAt: now,
              // Audit only, from the session — never read as a filter
              // (AGENTS.md §2).
              createdByStaffId: ctx.auth.user.id,
            })
            .returning(),
          db.insert(activityLog).values({
            entityType: ENTITY_TYPE,
            entityId: id,
            action: "created",
            summary: PAYMENT_ACTIVITY.created(
              formatPatientName(patient),
              formatDH(input.amountCents),
            ),
            staffId: ctx.auth.user.id,
          }),
        ]);

        return { status: "saved" as const, payment: created };
      } catch (error) {
        return rethrowWriteError(error);
      }
    }),

  /**
   * The admin, or the creator on the same clinic day. `patientId` is
   * immutable. The write is conditional on `expectedUpdatedAt`, the version
   * the editor loaded; the advance check counts this payment's stored amount
   * out of the balance before counting the new one in.
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

      const confirmation = {
        remainingCents: patient.remainingCents,
        amountCents: input.amountCents,
        previousAmountCents: existing.amountCents,
      };
      if (needsAdvanceConfirmation(confirmation) && !input.confirmAdvance) {
        return {
          status: "needs_confirmation" as const,
          remainingCents: patient.remainingCents,
          excessCents: advanceExcessCents(confirmation),
          payment: null,
        };
      }

      try {
        const [, [updated]] = await db.batch([
          logFromPayment(input.id, input.expectedUpdatedAt, {
            action: "updated",
            summary: PAYMENT_ACTIVITY.updated(
              formatPatientName(existing.patient),
              formatDH(existing.amountCents),
              formatDH(input.amountCents),
            ),
            staffId: ctx.auth.user.id,
          }),
          db
            .update(payments)
            .set({ ...writableValues(input), updatedAt: new Date() })
            .where(
              and(
                eq(payments.id, input.id),
                versionMatches(input.expectedUpdatedAt),
              ),
            )
            .returning(),
        ]);

        if (updated) return { status: "saved" as const, payment: updated };
      } catch (error) {
        return rethrowWriteError(error);
      }

      return notFoundOrConflict(input.id);
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
