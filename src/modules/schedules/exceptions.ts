import {
  clinicInstant,
  previousCalendarDate,
  startOfNextClinicDay,
  toClinicDate,
  toClinicWallClock,
  type ClinicDateInput,
} from "@/lib/time";

/**
 * A closure as entered — calendar days, optionally wall-clock times — and the
 * instants it is stored as. Both directions go through `src/lib/time.ts`, so
 * the clinic's offset (UTC+1, or UTC+0 during Ramadan) is never written down.
 *
 * A full-day closure runs from clinic-local midnight of the first day to
 * clinic-local midnight AFTER the last day: a half-open interval, the shape
 * the agenda's `startsAt < :end AND endsAt > :start` test expects, and the one
 * the seed already writes.
 */

export interface ExceptionPeriod {
  /** "yyyy-MM-dd", clinic calendar day. */
  startDate: string;
  endDate: string;
  allDay: boolean;
  /** "HH:mm" when `allDay` is false; ignored otherwise. */
  startTime: string;
  endTime: string;
}

const MIDNIGHT = "00:00";

export const exceptionToInstants = (
  period: ExceptionPeriod,
): { startsAt: Date; endsAt: Date } =>
  period.allDay
    ? {
        startsAt: clinicInstant(period.startDate, MIDNIGHT),
        endsAt: startOfNextClinicDay(period.endDate),
      }
    : {
        startsAt: clinicInstant(period.startDate, period.startTime),
        endsAt: clinicInstant(period.endDate, period.endTime),
      };

/**
 * The reverse, for the edit form and the list. Midnight to midnight reads as
 * whole days; anything else as a partial period with its times.
 */
export const instantsToExceptionPeriod = ({
  startsAt,
  endsAt,
}: {
  startsAt: ClinicDateInput;
  endsAt: ClinicDateInput;
}): ExceptionPeriod => {
  const startTime = toClinicWallClock(startsAt);
  const endTime = toClinicWallClock(endsAt);
  const startDate = toClinicDate(startsAt);
  const endDate = toClinicDate(endsAt);

  if (startTime === MIDNIGHT && endTime === MIDNIGHT && endDate > startDate) {
    return {
      startDate,
      endDate: previousCalendarDate(endDate),
      allDay: true,
      startTime: "",
      endTime: "",
    };
  }

  return { startDate, endDate, allDay: false, startTime, endTime };
};
