import {
  toClinicDate,
  wallClockToMinutes,
  toClinicWallClock,
  fromPgTime,
} from "@/lib/time";
import { isoWeekday } from "./lib/get-range-for-view";
import { BookingWarning } from "./types";

/**
 * Pure booking rules, shared by the procedures and their tests. Nothing here
 * touches the database.
 */

export interface Interval {
  startsAt: Date;
  endsAt: Date;
}

/**
 * The overlap predicate of 08-clinical.md §4 rule 6, `startsAt < :end AND
 * endsAt > :start`. Half-open, like the exclusion constraint's `'[)'`: 10:00–
 * 11:00 and 11:00–12:00 touch but do not overlap. `server/overlap.ts` builds
 * the same predicate in SQL.
 */
export const intervalsOverlap = (a: Interval, b: Interval): boolean =>
  a.startsAt.getTime() < b.endsAt.getTime() &&
  a.endsAt.getTime() > b.startsAt.getTime();

/** A row of `practitioner_schedules`, `time` columns as the driver returns them. */
export interface ScheduleRange {
  weekday: number;
  startTime: string;
  endTime: string;
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * Is the booking inside one range of the practitioner's weekly hours? Times
 * are compared on the clinic's wall clock — a `time` is never compared to a
 * `timestamptz` directly (08-clinical.md §4 rule 4).
 *
 * A practitioner with no hours at all is «unconfigured» (see
 * `isWeekConfigured`): there is nothing to be outside of, so no warning.
 */
const isWithinSchedule = (
  booking: Interval,
  ranges: readonly ScheduleRange[],
): boolean => {
  if (ranges.length === 0) return true;

  const day = toClinicDate(booking.startsAt);
  const weekday = isoWeekday(day);
  const start = wallClockToMinutes(toClinicWallClock(booking.startsAt));
  const durationMinutes =
    (booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000;
  const end = start + durationMinutes;

  // Past midnight is outside any single day's hours.
  if (end > MINUTES_PER_DAY) return false;

  return ranges.some(
    (range) =>
      range.weekday === weekday &&
      wallClockToMinutes(fromPgTime(range.startTime)) <= start &&
      end <= wallClockToMinutes(fromPgTime(range.endTime)),
  );
};

/**
 * Why a booking is out of hours — an empty list when it is not. These are
 * warnings the staff member confirms, never errors (08-clinical.md §4 rule 7).
 *
 * `closures` are the practitioner's leave and the clinic-wide closures; each
 * is tested against the booking here, so the caller may pass a superset.
 */
export const findBookingWarnings = (
  booking: Interval,
  ranges: readonly ScheduleRange[],
  closures: readonly Interval[],
): BookingWarning[] => {
  const warnings: BookingWarning[] = [];
  if (!isWithinSchedule(booking, ranges)) {
    warnings.push(BookingWarning.OutsideSchedule);
  }
  if (closures.some((closure) => intervalsOverlap(booking, closure))) {
    warnings.push(BookingWarning.Closure);
  }
  return warnings;
};
