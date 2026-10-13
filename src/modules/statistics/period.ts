import {
  addCalendarDays,
  calendarDateRange,
  isCalendarDate,
  toClinicDate,
  type ClinicDateInput,
  type InstantRange,
} from "@/lib/time";
import { periodDates } from "@/modules/dashboard/period";
import { DashboardPeriod } from "@/modules/dashboard/types";
import { previousPeriod as previousSameLength } from "@/modules/expenses/period";
import {
  MAX_CUSTOM_RANGE_MONTHS,
  STATISTICS_PERIOD_ERRORS as E,
} from "./constants";
import { StatisticsPeriod } from "./types";

/**
 * The `/statistiques` period, as clinic calendar days — pure and zone-free.
 * `now` is passed in, never read, so Vitest pins it. Instants are drawn only
 * through `src/lib/time.ts` (TZDate).
 *
 * «Ce mois-ci», «Le mois dernier» and «Cette année» are the DASHBOARD's own
 * periods (`periodDates`), not a second calculation of them: the two pages
 * can never bound «this month» differently. The month runs to its last day,
 * future days included — exactly like the dashboard and `/paiements`' default.
 */

export interface CalendarPeriod {
  from: string;
  to: string;
}

/** A period resolved: the days, the instants, and the period before it. */
export interface ResolvedPeriod extends CalendarPeriod {
  range: InstantRange;
  previous: CalendarPeriod & { range: InstantRange };
}

/** What the procedures receive (schemas.ts validates it). */
export interface PeriodInput {
  period: StatisticsPeriod;
  from: string;
  to: string;
}

const DAY_MS = 86_400_000;

const parse = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return { year, monthIndex: month - 1, date };
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const ymd = (probe: Date) =>
  `${probe.getUTCFullYear()}-${pad2(probe.getUTCMonth() + 1)}-${pad2(probe.getUTCDate())}`;

/** Whole calendar days from `from` to `to` (0 when equal). Zone-free. */
export const calendarDaysBetween = (from: string, to: string) => {
  const a = parse(from);
  const b = parse(to);
  return Math.round(
    (Date.UTC(b.year, b.monthIndex, b.date) -
      Date.UTC(a.year, a.monthIndex, a.date)) /
      DAY_MS,
  );
};

/** Days in `[from, to]`, both included. */
export const periodLength = ({ from, to }: CalendarPeriod) =>
  calendarDaysBetween(from, to) + 1;

/** The first day of the month `months` away from `day`'s month. */
export const firstDayOfMonth = (day: string, months = 0) => {
  const { year, monthIndex } = parse(day);
  return ymd(new Date(Date.UTC(year, monthIndex + months, 1)));
};

/** The last day of the month `months` away from `day`'s month. */
export const lastDayOfMonth = (day: string, months = 0) => {
  const { year, monthIndex } = parse(day);
  return ymd(new Date(Date.UTC(year, monthIndex + months + 1, 0)));
};

/**
 * The same day `months` later, clamped to the month's end (31 jan + 1 →
 * 28/29 fév). Zone-free.
 */
export const addCalendarMonths = (day: string, months: number) => {
  const { year, monthIndex, date } = parse(day);
  const last = new Date(Date.UTC(year, monthIndex + months + 1, 0));
  return ymd(
    new Date(
      Date.UTC(year, monthIndex + months, Math.min(date, last.getUTCDate())),
    ),
  );
};

/**
 * The last `to` a custom range starting on `from` may have: the day before
 * the same date 24 months later (24 whole months, never 24 months + 1 day).
 */
export const latestCustomEnd = (from: string) =>
  addCalendarDays(addCalendarMonths(from, MAX_CUSTOM_RANGE_MONTHS), -1);

/**
 * Why a custom range is refused, or null. French copy (constants.ts) — the
 * zod schema shows it on the server and the header shows the same text.
 * Presets are always valid.
 */
export const customRangeError = (
  input: PeriodInput,
  now: ClinicDateInput,
): string | null => {
  if (input.period !== StatisticsPeriod.Custom) return null;
  if (!isCalendarDate(input.from)) return E.fromInvalid;
  if (!isCalendarDate(input.to)) return E.toInvalid;
  if (input.from > input.to) return E.fromAfterTo;
  if (input.to > toClinicDate(now)) return E.toInFuture;
  if (input.to > latestCustomEnd(input.from)) return E.tooLong;
  return null;
};

/** Days → the same days shifted back by whole months (month-shaped periods). */
const shiftMonths = (
  period: CalendarPeriod,
  months: number,
): CalendarPeriod => ({
  from: firstDayOfMonth(period.from, -months),
  to: lastDayOfMonth(period.to, -months),
});

const withRange = (period: CalendarPeriod) => ({
  ...period,
  range: calendarDateRange(period.from, period.to),
});

/**
 * The calendar days of a VALID input (call `customRangeError` first), and
 * the period before it «of equal length»:
 *
 * - month-shaped presets (this month, last month, this year, last 12
 *   months) compare with the same number of whole calendar months just
 *   before — October with September, 2026 with 2025. A «same number of days»
 *   would compare 1–31 October with 31 August–30 September;
 * - «90 derniers jours» and a custom range compare with the same number of
 *   days just before (the `/charges` rule, `expenses/period.ts`).
 */
export const resolvePeriod = (
  input: PeriodInput,
  now: ClinicDateInput,
): ResolvedPeriod => {
  const today = toClinicDate(now);
  let current: CalendarPeriod;
  let previous: CalendarPeriod;

  switch (input.period) {
    case StatisticsPeriod.ThisMonth:
      current = periodDates(DashboardPeriod.Month, now);
      previous = shiftMonths(current, 1);
      break;
    case StatisticsPeriod.LastMonth:
      current = periodDates(DashboardPeriod.LastMonth, now);
      previous = shiftMonths(current, 1);
      break;
    case StatisticsPeriod.ThisYear:
      current = periodDates(DashboardPeriod.Year, now);
      previous = shiftMonths(current, 12);
      break;
    case StatisticsPeriod.Last12Months:
      current = {
        from: firstDayOfMonth(today, -11),
        to: lastDayOfMonth(today),
      };
      previous = shiftMonths(current, 12);
      break;
    case StatisticsPeriod.Last90Days:
      current = { from: addCalendarDays(today, -89), to: today };
      previous = previousSameLength(current.from, current.to)!;
      break;
    case StatisticsPeriod.Custom:
      current = { from: input.from, to: input.to };
      previous = previousSameLength(current.from, current.to)!;
      break;
  }

  return { ...withRange(current), previous: withRange(previous) };
};

/**
 * The query input the page prefetches and the view subscribes to — ONE
 * function for both (04-hydration.md §4 rule 11). A preset drops `from` /
 * `to`, so a stale custom range left in the URL never splits the cache key.
 */
export const toPeriodInput = (filters: PeriodInput): PeriodInput =>
  filters.period === StatisticsPeriod.Custom
    ? { period: filters.period, from: filters.from, to: filters.to }
    : { period: filters.period, from: "", to: "" };
