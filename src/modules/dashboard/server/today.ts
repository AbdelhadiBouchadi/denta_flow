import { and, eq, gte, inArray, lt, ne, sql, type SQL } from "drizzle-orm";

import { appointments } from "@/database/schema";
import type { InstantRange } from "@/lib/time";
import { AppointmentStatus } from "@/modules/appointments/types";
import { EXCLUDED_FROM_DAY, REMAINING_STATUSES } from "../rules";

/**
 * The day's appointment predicates — the ONE place each is written. The KPI
 * cards count through exactly the fragments the list selects through, so a
 * card and the list can never show different totals.
 *
 * `range` is today's clinic day, drawn in TypeScript (`clinicDayRange`) and
 * sent as two instants. Never a day computed or truncated in SQL: the
 * database runs in UTC.
 *
 * Free of `db` and `server-only`: fragments only.
 */

/** `startsAt` inside `[start, end)`. */
const startsWithin = (range: InstantRange) =>
  and(
    gte(appointments.startsAt, range.start),
    lt(appointments.startsAt, range.end),
  );

/** «Rendez-vous du jour»: today, `canceled` excluded. */
export const isDayAppointment = (range: InstantRange) =>
  and(startsWithin(range), ne(appointments.status, EXCLUDED_FROM_DAY));

/** «Restants»: not terminal yet, whatever the clock says. */
export const isRemaining = inArray(appointments.status, [
  ...REMAINING_STATUSES,
]);

/**
 * «Salle d’attente»: arrived, and booked today — an arrival never closed
 * yesterday is not in today's waiting room.
 */
export const isWaiting = (range: InstantRange) =>
  and(startsWithin(range), eq(appointments.status, AppointmentStatus.Arrived));

export const isCompleted = eq(appointments.status, AppointmentStatus.Completed);

/** A restant whose start is before `lateBefore` — «En retard», display only. */
export const isLate = (lateBefore: Date) =>
  and(isRemaining, lt(appointments.startsAt, lateBefore));

/** `COUNT(*) FILTER (WHERE …)` — every count is Postgres's, never JavaScript's. */
export const countWhere = (predicate: SQL | undefined) =>
  sql<number>`(COUNT(*) FILTER (WHERE ${predicate}))::int`;
