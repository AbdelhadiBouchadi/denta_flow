import "server-only";

import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { PRACTITIONER_ROLES } from "@/constants";
import { db } from "@/database";
import {
  appointments,
  appointmentTypes,
  patients,
  practitionerSchedules,
  scheduleExceptions,
  user,
} from "@/database/schema";
import { formatTime } from "@/lib/format";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { findBookingWarnings, type Interval } from "../booking";
import { fromFormSlot } from "../form-values";
import {
  APPOINTMENT_DEFAULT_DURATION,
  APPOINTMENT_SERVER_ERRORS,
  overlapMessage,
  PATIENT_APPOINTMENTS_LIMIT,
} from "../constants";
import { getRangeForView, resolveAnchorDate } from "../lib/get-range-for-view";
import {
  appointmentFormSchema,
  appointmentGetManySchema,
  appointmentGetPageSchema,
  appointmentIdSchema,
  appointmentsByPatientSchema,
  appointmentStatusUpdateSchema,
  appointmentUpdateSchema,
  type AppointmentValues,
} from "../schemas";
import { pageWindow, totalPagesFor } from "../pagination";
import type { AppointmentStatus } from "../types";
import {
  changeStatus,
  guardedWrite,
  versionMatches,
  type AppointmentStatusStore,
} from "./concurrency";
import { rethrowAppointmentWriteError } from "./errors";
import {
  APPOINTMENT_LIST_ORDER,
  appointmentListWhere,
  clinicDayOfStart,
} from "./list-query";
import { overlappingAppointment } from "./overlap";
import { assertEditableBooking } from "./terminal-guard";

/**
 * Appointments are created, moved and cancelled by clinic staff only. There
 * is no availability procedure: the agenda shows occupied blocks and the
 * working-hours bounds, and the staff member reads the gaps (08-clinical.md §4).
 *
 * Reads are `protectedProcedure` with no staff scoping (AGENTS.md §2);
 * `remove` is the one `adminProcedure`.
 */

// ── Reads ───────────────────────────────────────────────────────────────────

/**
 * Every read nests the patient and the type as whole rows, so the agenda and
 * the list need no second query. The practitioner is a summary: the `user`
 * row also holds auth fields that have no business in a payload.
 */
const selectAppointments = () =>
  db
    .select({
      ...getTableColumns(appointments),
      patient: patients,
      type: appointmentTypes,
      practitioner: { id: user.id, name: user.name, color: user.color },
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(appointmentTypes, eq(appointments.typeId, appointmentTypes.id))
    .leftJoin(user, eq(appointments.practitionerId, user.id));

const notFound = () =>
  new TRPCError({
    code: "NOT_FOUND",
    message: APPOINTMENT_SERVER_ERRORS.notFound,
  });

// ── Booking rules ───────────────────────────────────────────────────────────

/**
 * The form's wall-clock slot as UTC instants — the one place a booking's
 * time is resolved, through the clinic timezone. The duration falls back to
 * the type's default, then to the clinic default (08-clinical.md §4 rule 9).
 */
const resolveSlot = async (input: AppointmentValues): Promise<Interval> => {
  let durationMinutes = input.durationMinutes ?? null;

  if (input.typeId) {
    const [type] = await db
      .select({
        defaultDurationMinutes: appointmentTypes.defaultDurationMinutes,
      })
      .from(appointmentTypes)
      .where(eq(appointmentTypes.id, input.typeId))
      .limit(1);

    if (!type) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: APPOINTMENT_SERVER_ERRORS.typeNotFound,
      });
    }
    durationMinutes ??= type.defaultDurationMinutes;
  }

  // The inverse of the form's `toFormValues`, in the same module.
  return fromFormSlot(input, durationMinutes ?? APPOINTMENT_DEFAULT_DURATION);
};

/**
 * Bookings go to active practitioners. `keepId` lets an edit keep the
 * practitioner the appointment already names, even if since deactivated.
 */
const assertPractitioner = async (id: string, keepId?: string | null) => {
  const [found] = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(user.id, id),
        keepId === id
          ? undefined
          : and(
              eq(user.isActive, true),
              inArray(user.role, [...PRACTITIONER_ROLES]),
            ),
      ),
    )
    .limit(1);

  if (!found) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: APPOINTMENT_SERVER_ERRORS.practitionerNotFound,
    });
  }
};

/**
 * The application-level overlap check: it produces the precise French
 * message in the normal case. Under concurrency the exclusion constraint is
 * what holds — see `rethrowAppointmentWriteError`.
 */
const assertNoOverlap = async (
  practitionerId: string,
  slot: Interval,
  excludeId?: string,
) => {
  const [clash] = await db
    .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt })
    .from(appointments)
    .where(overlappingAppointment({ practitionerId, ...slot, excludeId }))
    .orderBy(asc(appointments.startsAt))
    .limit(1);

  if (clash) {
    throw new TRPCError({
      code: "CONFLICT",
      message: overlapMessage(
        formatTime(clash.startsAt),
        formatTime(clash.endsAt),
      ),
    });
  }
};

/**
 * Out-of-hours reasons for a slot: outside the practitioner's weekly hours,
 * or inside their leave or a clinic-wide closure. Warnings, never errors.
 */
const bookingWarnings = async (practitionerId: string, slot: Interval) => {
  const [ranges, closures] = await Promise.all([
    db
      .select({
        weekday: practitionerSchedules.weekday,
        startTime: practitionerSchedules.startTime,
        endTime: practitionerSchedules.endTime,
      })
      .from(practitionerSchedules)
      .where(
        and(
          eq(practitionerSchedules.practitionerId, practitionerId),
          eq(practitionerSchedules.isActive, true),
        ),
      ),
    db
      .select({
        startsAt: scheduleExceptions.startsAt,
        endsAt: scheduleExceptions.endsAt,
      })
      .from(scheduleExceptions)
      .where(
        and(
          // A null practitioner is a clinic-wide closure.
          or(
            eq(scheduleExceptions.practitionerId, practitionerId),
            isNull(scheduleExceptions.practitionerId),
          ),
          lt(scheduleExceptions.startsAt, slot.endsAt),
          gt(scheduleExceptions.endsAt, slot.startsAt),
        ),
      ),
  ]);

  return findBookingWarnings(slot, ranges, closures);
};

// ── Concurrency ─────────────────────────────────────────────────────────────

/** The re-select a guarded write runs when its WHERE matched nothing. */
const appointmentExists = async (id: string) => {
  const [row] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);
  return row !== undefined;
};

/** `changeStatus`'s storage, in drizzle. Each method is one statement. */
const statusStore: AppointmentStatusStore<typeof appointments.$inferSelect> = {
  readStatus: async (id) => {
    const [row] = await db
      .select({ status: appointments.status })
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);
    // The pgEnum values and the TS enum are kept in lockstep (types.ts).
    return (row?.status as AppointmentStatus | undefined) ?? null;
  },
  writeStatusIf: async (id, from, to) => {
    const [updated] = await db
      .update(appointments)
      .set({ status: to, updatedAt: new Date() })
      .where(and(eq(appointments.id, id), eq(appointments.status, from)))
      .returning();
    return updated;
  },
  exists: appointmentExists,
};

// ── Router ──────────────────────────────────────────────────────────────────

export const appointmentsRouter = createTRPCRouter({
  /**
   * The appointments of one view's range. `date` and `view` arrive as the raw
   * URL values; the range is derived here, by the one `getRangeForView`, so
   * the page's prefetch and the view's query share a key by construction.
   *
   * Not paginated: the agenda draws the whole range on one screen, and a
   * range is at most a six-week month grid. The envelope is kept so every
   * getMany has the same shape (05-slice.md §5 rule 3).
   */
  getMany: protectedProcedure
    .input(appointmentGetManySchema)
    .query(async ({ input }) => {
      const range = getRangeForView(resolveAnchorDate(input.date), input.view);

      const items = await selectAppointments()
        .where(appointmentListWhere(range, input))
        .orderBy(...APPOINTMENT_LIST_ORDER);

      return { items, total: items.length, totalPages: 1 };
    }),

  /**
   * The `/rendez-vous` list, a page at a time — the same filters and range
   * as `getMany`, which stays unpaginated for the calendar.
   *
   * Three statements, one predicate: the page, its `total` (counted in SQL),
   * and the per-day counts the list's day headers read («8 rendez-vous»
   * counts the whole day, not only the rows that fit on this page).
   */
  getPage: protectedProcedure
    .input(appointmentGetPageSchema)
    .query(async ({ input }) => {
      const { page, pageSize } = input;
      const range = getRangeForView(resolveAnchorDate(input.date), input.view);
      const where = appointmentListWhere(range, input);
      const { limit, offset } = pageWindow(page, pageSize);

      const [items, [totals], dayCounts] = await Promise.all([
        selectAppointments()
          .where(where)
          // (startsAt, id): stable pages even when two bookings share an
          // instant (05-slice.md §5 rule 4).
          .orderBy(...APPOINTMENT_LIST_ORDER)
          .limit(limit)
          .offset(offset),
        db.select({ count: count() }).from(appointments).where(where),
        db
          .select({ day: clinicDayOfStart, count: count() })
          .from(appointments)
          .where(where)
          // By position: the expression carries a bound parameter (the zone
          // name), which Postgres would not match textually in GROUP BY.
          .groupBy(sql`1`)
          .orderBy(sql`1`),
      ]);

      return {
        items,
        total: totals.count,
        totalPages: totalPagesFor(totals.count, pageSize),
        dayCounts,
      };
    }),

  /**
   * The dossier's «Rendez-vous» tab: the patient's history, newest first,
   * capped at `PATIENT_APPOINTMENTS_LIMIT` rows. `total` is counted in SQL, so
   * the tab can say when the cap hides older ones.
   */
  getManyByPatient: protectedProcedure
    .input(appointmentsByPatientSchema)
    .query(async ({ input }) => {
      const where = eq(appointments.patientId, input.patientId);
      const [items, [totals]] = await Promise.all([
        selectAppointments()
          .where(where)
          .orderBy(desc(appointments.startsAt), desc(appointments.id))
          .limit(PATIENT_APPOINTMENTS_LIMIT),
        db.select({ count: count() }).from(appointments).where(where),
      ]);

      return { items, total: totals.count, totalPages: 1 };
    }),

  getOne: protectedProcedure
    .input(appointmentIdSchema)
    .query(async ({ input }) => {
      const [existing] = await selectAppointments().where(
        eq(appointments.id, input.id),
      );
      if (!existing) throw notFound();
      return existing;
    }),

  /**
   * Books a slot. An out-of-hours slot is answered with its warnings and
   * nothing is written until the staff member resubmits with
   * `confirmOutOfHours` — the warning is a flag in the response, not an error.
   */
  create: protectedProcedure
    .input(appointmentFormSchema)
    .mutation(async ({ input, ctx }) => {
      const slot = await resolveSlot(input);

      // Independent reads, one round trip each: run them side by side. The
      // overlap check comes before any confirmation, so nobody confirms an
      // overtime slot only to be told it is taken.
      const [, , warnings] = await Promise.all([
        assertPractitioner(input.practitionerId),
        assertNoOverlap(input.practitionerId, slot),
        bookingWarnings(input.practitionerId, slot),
      ]);

      if (warnings.length > 0 && !input.confirmOutOfHours) {
        return {
          requiresConfirmation: true as const,
          warnings,
          appointment: null,
        };
      }

      try {
        // Stamped here, not left to `defaultNow()`: every write to
        // appointments sets `updatedAt` from the app, at the millisecond
        // precision the version token travels in.
        const now = new Date();
        const [created] = await db
          .insert(appointments)
          .values({
            createdAt: now,
            updatedAt: now,
            patientId: input.patientId,
            practitionerId: input.practitionerId,
            typeId: input.typeId,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            reason: input.reason,
            notes: input.notes,
            // Always `planned`; status moves only through updateStatus.
            status: "planned",
            // Audit only, from the session — never read as a filter
            // (AGENTS.md §2).
            createdByStaffId: ctx.auth.user.id,
          })
          .returning();

        return {
          requiresConfirmation: false as const,
          warnings,
          appointment: created,
        };
      } catch (error) {
        return rethrowAppointmentWriteError(error);
      }
    }),

  /**
   * Moves or edits a booking. The same rules as `create`, excluding the row
   * itself from the overlap check. The status is untouched — see
   * `updateStatus`. A terminal booking (completed, canceled, no-show) keeps
   * its slot, practitioner, type and patient: only `reason` / `notes` save.
   *
   * Optimistic concurrency: the write is conditional on `expectedUpdatedAt`,
   * the version the editor loaded. The read below only feeds the booking
   * rules (slot changed? canceled?); it is never the concurrency guard, since
   * it happens in this request, long after the user opened the form.
   */
  update: protectedProcedure
    .input(appointmentUpdateSchema)
    .mutation(async ({ input }) => {
      const [existing] = await db
        .select({
          status: appointments.status,
          patientId: appointments.patientId,
          practitionerId: appointments.practitionerId,
          typeId: appointments.typeId,
          startsAt: appointments.startsAt,
          endsAt: appointments.endsAt,
        })
        .from(appointments)
        .where(eq(appointments.id, input.id))
        .limit(1);

      if (!existing) throw notFound();

      const slot = await resolveSlot(input);
      // Before any other rule: history is not rebooked. The pgEnum values and
      // the TS enum are kept in lockstep (types.ts).
      assertEditableBooking(existing.status as AppointmentStatus, existing, {
        patientId: input.patientId,
        practitionerId: input.practitionerId,
        typeId: input.typeId,
        ...slot,
      });
      const slotChanged =
        existing.practitionerId !== input.practitionerId ||
        existing.startsAt.getTime() !== slot.startsAt.getTime() ||
        existing.endsAt.getTime() !== slot.endsAt.getTime();

      const [, , warnings] = await Promise.all([
        assertPractitioner(input.practitionerId, existing.practitionerId),
        // A canceled appointment holds no slot — the constraint ignores it too.
        existing.status === "canceled"
          ? undefined
          : assertNoOverlap(input.practitionerId, slot, input.id),
        // Editing the notes of an overtime appointment must not ask for the
        // same confirmation again: only a new slot is re-warned.
        slotChanged ? bookingWarnings(input.practitionerId, slot) : [],
      ]);

      if (warnings.length > 0 && !input.confirmOutOfHours) {
        return {
          requiresConfirmation: true as const,
          warnings,
          appointment: null,
        };
      }

      try {
        const updated = await guardedWrite({
          write: async () => {
            const [row] = await db
              .update(appointments)
              .set({
                patientId: input.patientId,
                practitionerId: input.practitionerId,
                typeId: input.typeId,
                startsAt: slot.startsAt,
                endsAt: slot.endsAt,
                reason: input.reason,
                notes: input.notes,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(appointments.id, input.id),
                  versionMatches(input.expectedUpdatedAt),
                ),
              )
              .returning();
            return row;
          },
          exists: () => appointmentExists(input.id),
          conflictMessage:
            APPOINTMENT_SERVER_ERRORS.appointmentChangedMeanwhile,
        });

        return {
          requiresConfirmation: false as const,
          warnings,
          appointment: updated,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        return rethrowAppointmentWriteError(error);
      }
    }),

  /**
   * The status machine of `status.ts`, enforced here — never in the UI —
   * through `changeStatus`: the write is conditional on the status that was
   * checked, so two people clicking at once cannot both move the same
   * appointment.
   */
  updateStatus: protectedProcedure
    .input(appointmentStatusUpdateSchema)
    .mutation(async ({ input }) => {
      try {
        return await changeStatus(statusStore, input.id, input.status);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        return rethrowAppointmentWriteError(error);
      }
    }),

  // DESTRUCTIVE ⇒ admin, and the rejection comes from here, never from a
  // hidden button (AGENTS.md §2). Cancelling is the everyday action.
  remove: adminProcedure
    .input(appointmentIdSchema)
    .mutation(async ({ input }) => {
      // Treatments reference the appointment with `set null`: the actes stay.
      const [removed] = await db
        .delete(appointments)
        .where(eq(appointments.id, input.id))
        .returning();

      if (!removed) throw notFound();
      return removed;
    }),
});
