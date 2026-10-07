import { and, asc, eq, gte, lt, sql } from "drizzle-orm";

import { CLINIC_TIMEZONE } from "@/constants";
import { appointments } from "@/database/schema";
import type { DateRange } from "../lib/get-range-for-view";
import type { AppointmentStatus } from "../types";

/**
 * The list predicates and order shared by `getMany`, `getPage` and its count.
 * Free of `db` and `server-only` so their rendering is unit-tested.
 */

export interface AppointmentListFilters {
  practitionerId?: string | null;
  status?: AppointmentStatus | null;
  patientId?: string | null;
}

/**
 * ONE predicate for the page query, the count and the day counts, so `total`
 * always describes exactly the rows being paged (05-slice.md §5 rule 6).
 *
 * No staff scoping: `practitionerId` is a filter the user picks, never the
 * caller's id (AGENTS.md §2).
 */
export const appointmentListWhere = (
  range: DateRange,
  filters: AppointmentListFilters,
) =>
  and(
    gte(appointments.startsAt, range.from),
    lt(appointments.startsAt, range.to),
    filters.practitionerId
      ? eq(appointments.practitionerId, filters.practitionerId)
      : undefined,
    filters.status ? eq(appointments.status, filters.status) : undefined,
    filters.patientId
      ? eq(appointments.patientId, filters.patientId)
      : undefined,
  );

/**
 * The agenda's order: start ascending, id as the tiebreaker. Two bookings at
 * the same instant (two practitioners at 09:00) would otherwise come back in
 * any order, and a row could appear on two pages or on none.
 */
export const APPOINTMENT_LIST_ORDER = [
  asc(appointments.startsAt),
  asc(appointments.id),
] as const;

/**
 * The clinic calendar day of a booking, "yyyy-MM-dd", for the day headers'
 * counts. Read through Postgres's IANA database with the clinic zone name —
 * never an offset — so Ramadan days group correctly.
 */
export const clinicDayOfStart = sql<string>`to_char(${appointments.startsAt} AT TIME ZONE ${CLINIC_TIMEZONE}, 'YYYY-MM-DD')`;
