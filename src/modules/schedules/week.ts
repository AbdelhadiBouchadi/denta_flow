import { fromPgTime, WALL_CLOCK_PATTERN, wallClockToMinutes } from "@/lib/time";
import {
  SCHEDULE_MAX_RANGES_PER_DAY,
  SCHEDULE_VALIDATION_MESSAGES as M,
  WEEKDAYS,
  type Weekday,
} from "./constants";

/**
 * Pure weekly-hours logic, shared by the schema, the procedures and the
 * editor. Nothing here touches a timezone: a range is a wall-clock reading,
 * resolved against a clinic day only in `src/lib/time.ts`.
 */

export interface WeekRange {
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface DayRanges {
  weekday: Weekday;
  ranges: { startTime: string; endTime: string }[];
}

/**
 * Database rows (`time` as "HH:mm:ss") → seven days, lundi first, each day's
 * ranges sorted by start, times as "HH:mm". A day with no row is an empty
 * list — «Fermé» in a configured week.
 */
export const groupWeek = (rows: readonly WeekRange[]): DayRanges[] =>
  WEEKDAYS.map((weekday) => ({
    weekday,
    ranges: rows
      .filter((row) => row.weekday === weekday)
      .map((row) => ({
        startTime: fromPgTime(row.startTime),
        endTime: fromPgTime(row.endTime),
      }))
      .sort(
        (a, b) =>
          wallClockToMinutes(a.startTime) - wallClockToMinutes(b.startTime),
      ),
  }));

/** Seven days back to the flat list `setWeek` takes. */
export const flattenWeek = (days: readonly DayRanges[]): WeekRange[] =>
  days.flatMap(({ weekday, ranges }) =>
    ranges.map((range) => ({ weekday, ...range })),
  );

export interface RangeIssue {
  /** Index in the flat `ranges` list — the form's field-array index. */
  index: number;
  field: "startTime" | "endTime";
  message: string;
}

/**
 * Cross-range rules, on ranges whose own fields are already valid "HH:mm":
 * start before end (no overnight range), no overlap within a weekday, at most
 * three ranges a day. Touching ranges (12:00–14:00 then 14:00–18:00) do not
 * overlap. Each issue lands on the range that breaks the rule, so the editor
 * shows it under that row.
 */
export const findRangeIssues = (ranges: readonly WeekRange[]): RangeIssue[] => {
  const issues: RangeIssue[] = [];
  // A malformed time is the field schema's to report; it is not compared.
  const isWellFormed = (range: WeekRange) =>
    WALL_CLOCK_PATTERN.test(range.startTime) &&
    WALL_CLOCK_PATTERN.test(range.endTime);

  ranges.forEach((range, index) => {
    if (!isWellFormed(range)) return;
    if (
      wallClockToMinutes(range.startTime) >= wallClockToMinutes(range.endTime)
    ) {
      issues.push({ index, field: "endTime", message: M.endBeforeStart });
    }
  });

  for (const weekday of WEEKDAYS) {
    const sameDay = ranges
      .map((range, index) => ({ ...range, index }))
      .filter((range) => range.weekday === weekday);

    sameDay.slice(SCHEDULE_MAX_RANGES_PER_DAY).forEach(({ index }) => {
      issues.push({ index, field: "startTime", message: M.tooManyRanges });
    });

    const ordered = sameDay
      .filter(isWellFormed)
      .map((range) => ({
        index: range.index,
        start: wallClockToMinutes(range.startTime),
        end: wallClockToMinutes(range.endTime),
      }))
      .filter(({ start, end }) => start < end)
      .sort((a, b) => a.start - b.start || a.end - b.end);

    let latestEnd = -1;
    for (const range of ordered) {
      if (range.start < latestEnd) {
        issues.push({
          index: range.index,
          field: "startTime",
          message: M.overlap,
        });
      }
      latestEnd = Math.max(latestEnd, range.end);
    }
  }

  return issues;
};

/**
 * «Copier vers…»: every target day's ranges become a copy of the source
 * day's. The source and untouched days keep their place in the list.
 */
export const copyDay = (
  ranges: readonly WeekRange[],
  source: number,
  targets: readonly number[],
): WeekRange[] => {
  const targetSet = new Set(targets.filter((weekday) => weekday !== source));
  const sourceRanges = ranges.filter((range) => range.weekday === source);

  return [
    ...ranges.filter((range) => !targetSet.has(range.weekday)),
    ...[...targetSet]
      .sort((a, b) => a - b)
      .flatMap((weekday) =>
        sourceRanges.map(({ startTime, endTime }) => ({
          weekday,
          startTime,
          endTime,
        })),
      ),
  ];
};
