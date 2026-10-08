import {
  addCalendarDays,
  calendarDateRange,
  toClinicDate,
  toClinicTime,
  type ClinicDateInput,
  type InstantRange,
} from "@/lib/time";
import { DashboardPeriod } from "./types";

/**
 * The «Encaissements» periods as clinic calendar days, both included —
 * the same `from` / `to` shape `/paiements` filters on, so a period here and
 * the same dates there select exactly the same payments. Pure: `now` is
 * passed in, never read, so Vitest pins it.
 */
export interface CalendarPeriod {
  from: string;
  to: string;
}

const pad2 = (value: number) => String(value).padStart(2, "0");

/** The last day of a month, `monthIndex` 0-based; rolls over year ends. */
const lastDayOf = (year: number, monthIndex: number) => {
  const probe = new Date(Date.UTC(year, monthIndex + 1, 0));
  return `${probe.getUTCFullYear()}-${pad2(probe.getUTCMonth() + 1)}-${pad2(probe.getUTCDate())}`;
};

const firstDayOf = (year: number, monthIndex: number) => {
  const probe = new Date(Date.UTC(year, monthIndex, 1));
  return `${probe.getUTCFullYear()}-${pad2(probe.getUTCMonth() + 1)}-01`;
};

export const periodDates = (
  period: DashboardPeriod,
  now: ClinicDateInput,
): CalendarPeriod => {
  const today = toClinicDate(now);
  const local = toClinicTime(now);
  const year = local.getFullYear();
  const monthIndex = local.getMonth();

  switch (period) {
    case DashboardPeriod.Today:
      return { from: today, to: today };
    case DashboardPeriod.Week: {
      // ISO weekday: lundi = 1 … dimanche = 7 (WEEK_STARTS_ON = 1).
      const isoWeekday = local.getDay() === 0 ? 7 : local.getDay();
      const monday = addCalendarDays(today, 1 - isoWeekday);
      return { from: monday, to: addCalendarDays(monday, 6) };
    }
    case DashboardPeriod.Month:
      return {
        from: firstDayOf(year, monthIndex),
        to: lastDayOf(year, monthIndex),
      };
    case DashboardPeriod.LastMonth:
      return {
        from: firstDayOf(year, monthIndex - 1),
        to: lastDayOf(year, monthIndex - 1),
      };
    case DashboardPeriod.Year:
      return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
};

/** The period as instants, `[start, end)`, for the SQL. */
export const periodRange = (
  period: DashboardPeriod,
  now: ClinicDateInput,
): InstantRange => {
  const { from, to } = periodDates(period, now);
  return calendarDateRange(from, to);
};
