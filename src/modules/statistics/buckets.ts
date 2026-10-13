import { format } from "date-fns";
import { fr } from "date-fns/locale";

import {
  addCalendarDays,
  clinicInstant,
  startOfNextClinicDay,
  toClinicTime,
} from "@/lib/time";
import { MAX_DAY_BUCKET_DAYS, MAX_WEEK_BUCKET_DAYS } from "./constants";
import {
  calendarDaysBetween,
  lastDayOfMonth,
  periodLength,
  type CalendarPeriod,
} from "./period";
import { Granularity } from "./types";

/**
 * Time buckets are built HERE, in TypeScript, never grouped in SQL
 * (prompts/30, decision 4). Each bucket is a run of clinic calendar days with
 * its clinic-midnight instants; the server sends the starts to Postgres as
 * one parameter and counts each row into its bucket with `width_bucket`
 * (server/sql.ts). Empty buckets are zero-filled from this list, so a day
 * with no payment still has a point at 0.
 *
 * Pure and zone-free apart from `src/lib/time.ts`: the result is the same
 * whatever the server's or the viewer's zone.
 */

export interface Bucket {
  /** "2026-10-08" (day, week start) or "2026-10" (month). Stable React key. */
  key: string;
  /** First and last clinic day of the bucket, both included. */
  from: string;
  to: string;
  /** Clinic midnight of `from` … clinic midnight after `to`: `[start, end)`. */
  start: Date;
  end: Date;
  /** Short French axis label: «8 oct.», «oct. 26». */
  label: string;
  /** Long French tooltip label: «jeudi 8 octobre 2026». */
  longLabel: string;
}

/** ≤ 31 days → day; ≤ 120 days → week; otherwise month. */
export const granularityFor = (period: CalendarPeriod): Granularity => {
  const days = periodLength(period);
  if (days <= MAX_DAY_BUCKET_DAYS) return Granularity.Day;
  if (days <= MAX_WEEK_BUCKET_DAYS) return Granularity.Week;
  return Granularity.Month;
};

/** ISO weekday of a calendar day: lundi = 1 … dimanche = 7. Zone-free. */
export const isoWeekdayOfDay = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
};

/** A calendar day formatted on the clinic's wall clock, in French. */
const formatDay = (day: string, pattern: string) =>
  format(toClinicTime(clinicInstant(day)), pattern, { locale: fr });

/** Exported for Vitest: the French labels of one bucket. */
export const bucketLabels = (
  granularity: Granularity,
  from: string,
  to: string,
): Pick<Bucket, "label" | "longLabel"> => {
  switch (granularity) {
    case Granularity.Day:
      return {
        label: formatDay(from, "d MMM"),
        longLabel: formatDay(from, "EEEE d MMMM yyyy"),
      };
    case Granularity.Week:
      return {
        label: formatDay(from, "d MMM"),
        longLabel:
          from === to
            ? `Semaine du ${formatDay(from, "d MMMM yyyy")}`
            : `Semaine du ${formatDay(from, "d MMMM")} au ${formatDay(to, "d MMMM yyyy")}`,
      };
    case Granularity.Month:
      return {
        label: formatDay(from, "MMM yy"),
        longLabel: formatDay(from, "MMMM yyyy"),
      };
  }
};

/** The last day of the bucket that starts on `from`, before clipping. */
const naturalEnd = (granularity: Granularity, from: string) => {
  switch (granularity) {
    case Granularity.Day:
      return from;
    case Granularity.Week:
      // Monday-first: the bucket closes on Sunday.
      return addCalendarDays(from, 7 - isoWeekdayOfDay(from));
    case Granularity.Month:
      return lastDayOfMonth(from);
  }
};

/**
 * The buckets of `[from, to]`, contiguous, in order. The first and last
 * week or month are clipped to the period, so the buckets cover the period
 * exactly — no day twice, no day missing — and their sums add up to the
 * period's total.
 */
export const buildBuckets = (
  period: CalendarPeriod,
  granularity: Granularity = granularityFor(period),
): Bucket[] => {
  const buckets: Bucket[] = [];
  let from = period.from;

  while (calendarDaysBetween(from, period.to) >= 0) {
    const natural = naturalEnd(granularity, from);
    const to = natural < period.to ? natural : period.to;
    buckets.push({
      key: granularity === Granularity.Month ? from.slice(0, 7) : from,
      from,
      to,
      start: clinicInstant(from),
      end: startOfNextClinicDay(to),
      ...bucketLabels(granularity, from, to),
    });
    from = addCalendarDays(to, 1);
  }

  return buckets;
};

// ── Weekday × hour slots (Fréquentation) ────────────────────────────────────

/** One hour of the clinic's wall clock on one day, as an instant range start. */
export interface HourSlot {
  start: Date;
  /** 0 = lundi … 6 = dimanche. */
  weekdayIndex: number;
  /** 0 … 23, read on the clinic's wall clock. */
  hour: number;
}

/** `weekdayIndex * 24 + hour` — the heatmap cell a slot counts into. */
export const slotClass = (weekdayIndex: number, hour: number) =>
  weekdayIndex * 24 + hour;

/**
 * Every clinic wall-clock hour in `[from, to]`, as strictly increasing
 * instants. The weekday and the hour of each slot are READ BACK from its own
 * instant through the clinic timezone — never assumed from its position — so
 * the hour that does not exist when the clock jumps forward is skipped, and
 * the hour that repeats when it falls back maps to the same wall hour twice.
 * Nothing about the clinic's clock is computed in SQL.
 */
export const buildHourSlots = (period: CalendarPeriod): HourSlot[] => {
  const slots: HourSlot[] = [];
  let day = period.from;

  while (calendarDaysBetween(day, period.to) >= 0) {
    const dayStart = clinicInstant(day).getTime();
    const dayEnd = startOfNextClinicDay(day).getTime();
    // Hourly steps over the real instants of the day: 23, 24 or 25 of them.
    for (let instant = dayStart; instant < dayEnd; instant += 3_600_000) {
      const local = toClinicTime(instant);
      const weekday = local.getDay() === 0 ? 7 : local.getDay();
      slots.push({
        start: new Date(instant),
        weekdayIndex: weekday - 1,
        hour: local.getHours(),
      });
    }
    day = addCalendarDays(day, 1);
  }

  return slots;
};

/** One slot per clinic day, with its weekday — the weekday bar chart. */
export const buildDaySlots = (period: CalendarPeriod) => {
  const slots: { start: Date; weekdayIndex: number }[] = [];
  let day = period.from;
  while (calendarDaysBetween(day, period.to) >= 0) {
    slots.push({
      start: clinicInstant(day),
      weekdayIndex: isoWeekdayOfDay(day) - 1,
    });
    day = addCalendarDays(day, 1);
  }
  return slots;
};
