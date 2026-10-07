import {
  clinicInstant,
  clinicNow,
  isCalendarDate,
  toClinicDate,
} from "@/lib/time";
import { AGENDA_DAYS_TO_SHOW } from "../constants";
import { CalendarView } from "../types";

/**
 * The ONE derivation of the instants a view covers (04-hydration.md §4 rule
 * 11, 07-calendar.md §5). `appointments.getMany` takes `date` + `view` — the
 * raw URL values — and calls this itself, so the page's prefetch key and the
 * view's query key are the nuqs values verbatim and cannot drift.
 *
 * Every range is half-open, `[from, to)`, and both ends are clinic-local
 * midnights resolved through `clinicInstant`: a week that crosses the end of
 * Ramadan starts at UTC+0 and ends at UTC+1, with no offset written anywhere.
 * The day arithmetic itself is zone-free, on "yyyy-MM-dd" strings.
 */

export interface DateRange {
  from: Date;
  to: Date;
}

const pad2 = (value: number) => String(value).padStart(2, "0");

const toParts = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return { year, monthIndex: month - 1, day };
};

const fromUtcDate = (probe: Date) =>
  `${probe.getUTCFullYear()}-${pad2(probe.getUTCMonth() + 1)}-${pad2(probe.getUTCDate())}`;

/** "2026-03-30" + 3 → "2026-04-02". Zone-free. */
export const addCalendarDays = (date: string, days: number): string => {
  const { year, monthIndex, day } = toParts(date);
  return fromUtcDate(new Date(Date.UTC(year, monthIndex, day + days)));
};

/** ISO weekday of a calendar date: 1 = lundi … 7 = dimanche. */
export const isoWeekday = (date: string): number => {
  const { year, monthIndex, day } = toParts(date);
  const sundayFirst = new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
  return sundayFirst === 0 ? 7 : sundayFirst;
};

/** The Monday of the week containing `date` (WEEK_STARTS_ON = 1). */
const mondayOf = (date: string) => addCalendarDays(date, 1 - isoWeekday(date));

/**
 * The anchor day a view is drawn around. An empty or malformed `date` — the
 * URL's default — means today on the clinic's wall clock, never the server's.
 */
export const resolveAnchorDate = (date: string | null | undefined): string =>
  date && isCalendarDate(date) ? date : toClinicDate(clinicNow());

/**
 * The calendar days `[first, afterLast)` the view shows. The month view is
 * the full Monday-to-Sunday grid around the month, since the calendar renders
 * the leading and trailing days of neighbouring months too.
 */
export const getDaysForView = (
  date: string,
  view: CalendarView,
): { first: string; afterLast: string } => {
  switch (view) {
    case CalendarView.Day:
      return { first: date, afterLast: addCalendarDays(date, 1) };
    case CalendarView.Week: {
      const monday = mondayOf(date);
      return { first: monday, afterLast: addCalendarDays(monday, 7) };
    }
    case CalendarView.Month: {
      const { year, monthIndex } = toParts(date);
      const firstOfMonth = fromUtcDate(new Date(Date.UTC(year, monthIndex, 1)));
      const lastOfMonth = fromUtcDate(
        new Date(Date.UTC(year, monthIndex + 1, 0)),
      );
      return {
        first: mondayOf(firstOfMonth),
        afterLast: addCalendarDays(mondayOf(lastOfMonth), 7),
      };
    }
    case CalendarView.Agenda:
      return {
        first: date,
        afterLast: addCalendarDays(date, AGENDA_DAYS_TO_SHOW),
      };
  }
};

/** `[from, to)` as UTC instants — what the procedure filters `startsAt` on. */
export const getRangeForView = (
  date: string,
  view: CalendarView,
): DateRange => {
  const { first, afterLast } = getDaysForView(date, view);
  return { from: clinicInstant(first), to: clinicInstant(afterLast) };
};

/**
 * The anchor of the previous / next period, for the header's arrows. Month
 * navigation lands on the 1st, so 31 January + 1 month never skips February.
 */
export const shiftAnchorDate = (
  date: string,
  view: CalendarView,
  direction: 1 | -1,
): string => {
  switch (view) {
    case CalendarView.Day:
      return addCalendarDays(date, direction);
    case CalendarView.Week:
      return addCalendarDays(date, 7 * direction);
    case CalendarView.Month: {
      const { year, monthIndex } = toParts(date);
      return fromUtcDate(new Date(Date.UTC(year, monthIndex + direction, 1)));
    }
    case CalendarView.Agenda:
      return addCalendarDays(date, AGENDA_DAYS_TO_SHOW * direction);
  }
};
