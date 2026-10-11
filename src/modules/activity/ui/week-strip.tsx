"use client";

import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { ACTIVITY_COPY as COPY } from "../constants";
import type { ActivityDayCounts } from "../types";

interface Props {
  days: ActivityDayCounts["days"];
  selected: string;
  today: string;
  onSelect: (day: string) => void;
}

/**
 * Monday → Sunday, each day with its weekday, its number and its count. The
 * strip scrolls inside its own container on a narrow phone and never widens
 * the page (`min-w-0` on the scroller, a fixed minimum on the grid).
 *
 * The labels come from the calendar day itself — `parseISO("yyyy-MM-dd")` is
 * local midnight, read back as local fields, so the server render and every
 * browser print the same weekday whatever their zone.
 */
const WeekStrip = ({ days, selected, today, onSelect }: Props) => (
  <div className="-mx-1 min-w-0 overflow-x-auto px-1 pb-1">
    <ol className="grid min-w-[19.5rem] grid-cols-7 gap-1">
      {days.map((day) => {
        const date = parseISO(day.date);
        const isSelected = day.date === selected;
        const isToday = day.date === today;

        return (
          <li key={day.date}>
            <button
              type="button"
              disabled={day.isFuture}
              aria-pressed={isSelected}
              aria-label={`${format(date, "EEEE d MMMM", { locale: fr })} — ${COPY.dayCount(day.count)}`}
              onClick={() => onSelect(day.date)}
              className={cn(
                "flex w-full flex-col items-center gap-0.5 rounded-lg border px-1 py-2 transition-colors",
                "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
                "disabled:pointer-events-none disabled:opacity-40",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "text-label uppercase",
                  isSelected ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {format(date, "EEEEEE", { locale: fr })}
              </span>
              <span
                className={cn(
                  "font-heading text-lg leading-none font-semibold tabular-nums",
                  isToday && !isSelected && "text-primary",
                )}
              >
                {format(date, "d")}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "text-label min-h-4 tabular-nums",
                  isSelected ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {day.isFuture ? "" : day.count === 0 ? "·" : day.count}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  </div>
);

export default WeekStrip;
