import { WEEK_COPY, WEEKDAY_LABELS } from "../constants";
import type { DayRanges } from "../week";

interface WeekSummaryProps {
  days: DayRanges[];
}

/**
 * The read-only week a non-admin sees: no field, no button. Same rows as the
 * editor, so both read alike.
 */
export const WeekSummary = ({ days }: WeekSummaryProps) => (
  <ul className="divide-border flex flex-col divide-y rounded-lg border">
    {days.map((day) => (
      <li
        key={day.weekday}
        className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
      >
        <span className="text-foreground w-28 shrink-0 font-medium">
          {WEEKDAY_LABELS[day.weekday]}
        </span>
        {day.ranges.length === 0 ? (
          <span className="text-muted-foreground text-sm">
            {WEEK_COPY.closed}
          </span>
        ) : (
          <span className="text-foreground-secondary flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
            {day.ranges.map((range) => (
              <span key={`${range.startTime}-${range.endTime}`}>
                {range.startTime} {WEEK_COPY.rangeSeparator} {range.endTime}
              </span>
            ))}
          </span>
        )}
      </li>
    ))}
  </ul>
);
