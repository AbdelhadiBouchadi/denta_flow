import { WEEK_STARTS_ON } from "@/constants";
import { addCalendarDays, isCalendarDate } from "@/lib/time";

/**
 * Calendar-day arithmetic for the week strip. A day here is a clinic
 * calendar day "yyyy-MM-dd" — never an instant — so nothing goes through the
 * browser's or the server's zone: the weekday of a calendar date is the same
 * everywhere. Instants are drawn from these days only in the procedure,
 * through `calendarDateRange` (src/lib/time.ts). Free of `db`.
 */

/** ISO weekday of a calendar day: 1 = lundi … 7 = dimanche. */
export const isoWeekdayOf = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
};

/** The Monday (WEEK_STARTS_ON) of the week that holds `day`. */
export const weekStartOf = (day: string) =>
  addCalendarDays(day, -((isoWeekdayOf(day) - WEEK_STARTS_ON + 7) % 7));

/** The seven days, Monday first, of the week that holds `day`. */
export const weekDaysOf = (day: string) => {
  const start = weekStartOf(day);
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(start, index));
};

/**
 * The day an input names: a valid calendar day, or `today` for "" — the
 * URL's default. Anything else is `null` (the procedure rejects it).
 */
export const resolveActivityDay = (raw: string, today: string) => {
  if (raw === "") return today;
  return isCalendarDate(raw) ? raw : null;
};

/** "yyyy-MM-dd" strings compare in calendar order. */
export const isFutureDay = (day: string, today: string) => day > today;
