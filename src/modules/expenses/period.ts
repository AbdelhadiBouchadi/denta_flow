import type { OptionalInstantRange } from "@/database/sql/range";
import {
  addCalendarDays,
  calendarDateRange,
  clinicInstant,
  isCalendarDate,
  startOfNextClinicDay,
  type InstantRange,
} from "@/lib/time";

/**
 * The `/charges` period, as clinic calendar days. Pure and zone-free: every
 * day arithmetic here is on "yyyy-MM-dd" strings, and the instants are drawn
 * only through `src/lib/time.ts` (TZDate) — so the same filter selects the
 * same charges whatever the server's or the browser's zone.
 */

const DAY_MS = 86_400_000;

/** Whole calendar days from `from` to `to` (0 when equal). Zone-free. */
const calendarDaysBetween = (from: string, to: string) => {
  const utc = (day: string) => {
    const [year, month, date] = day.split("-").map(Number);
    return Date.UTC(year, month - 1, date);
  };
  return Math.round((utc(to) - utc(from)) / DAY_MS);
};

/**
 * The list filter's bounds as instants: clinic midnight of `from`, up to
 * clinic midnight after `to`. A malformed or empty bound is open-ended.
 */
export const filterRange = (from: string, to: string): OptionalInstantRange => ({
  start: isCalendarDate(from) ? clinicInstant(from) : undefined,
  end: isCalendarDate(to) ? startOfNextClinicDay(to) : undefined,
});

/**
 * The same-length period just before `[from, to]` (both included), or null
 * when either bound is missing or the range is inverted — an open-ended
 * period has no «previous». 1–31 October → 31 August–30 September (31 days);
 * one day → the day before.
 */
export const previousPeriod = (
  from: string,
  to: string,
): { from: string; to: string } | null => {
  if (!isCalendarDate(from) || !isCalendarDate(to)) return null;
  const span = calendarDaysBetween(from, to);
  if (span < 0) return null;
  const previousTo = addCalendarDays(from, -1);
  return { from: addCalendarDays(previousTo, -span), to: previousTo };
};

/** `previousPeriod` as instants for the SQL, or null. */
export const previousPeriodRange = (
  from: string,
  to: string,
): InstantRange | null => {
  const previous = previousPeriod(from, to);
  return previous ? calendarDateRange(previous.from, previous.to) : null;
};
