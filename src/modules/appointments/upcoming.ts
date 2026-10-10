import { AppointmentStatus } from "./types";

/**
 * «Prochains rendez-vous» on the dossier header (prompts/25) — the ONE
 * definition, read by `appointments.getUpcomingByPatient` in SQL and by the
 * tests here.
 *
 * Upcoming = a non-terminal booking (planned, confirmed, arrived) that is not
 * over yet: `endsAt > now`, not `startsAt >= now`, so the patient sitting in
 * the waiting room for a slot that began five minutes ago is still listed.
 * Completed, canceled and no-show bookings are history, never upcoming.
 */
export const UPCOMING_APPOINTMENT_STATUSES = [
  AppointmentStatus.Planned,
  AppointmentStatus.Confirmed,
  AppointmentStatus.Arrived,
] as const;

/** How many the header shows. */
export const UPCOMING_APPOINTMENTS_LIMIT = 3;

const UPCOMING = new Set<string>(UPCOMING_APPOINTMENT_STATUSES);

export const isUpcomingAppointment = (
  { status, endsAt }: { status: string; endsAt: Date },
  now: Date,
) => UPCOMING.has(status) && endsAt.getTime() > now.getTime();

/**
 * The selection, in TS: soonest first, the id breaking ties, capped. The
 * procedure does the same in SQL; this is the spec its fixture is checked
 * against.
 */
export const selectUpcomingAppointments = <
  T extends { id: string; status: string; startsAt: Date; endsAt: Date },
>(
  items: readonly T[],
  now: Date,
) =>
  items
    .filter((item) => isUpcomingAppointment(item, now))
    .sort(
      (a, b) =>
        a.startsAt.getTime() - b.startsAt.getTime() ||
        a.id.localeCompare(b.id),
    )
    .slice(0, UPCOMING_APPOINTMENTS_LIMIT);
