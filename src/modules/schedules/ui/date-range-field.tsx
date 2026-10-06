"use client";

import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { WEEK_STARTS_ON } from "@/constants";
import { clinicNow } from "@/lib/time";
import { EXCEPTION_COPY, formatCalendarDate } from "../constants";

interface DateRangeFieldProps {
  /** "yyyy-MM-dd" or "" — clinic calendar days, never instants. */
  startDate: string;
  endDate: string;
  onChange: (range: { startDate: string; endDate: string }) => void;
  id?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}

/**
 * The project's date pattern — `react-day-picker` in a `<Popover>` — in range
 * mode. The picker hands back Dates at local midnight; only their calendar
 * fields are read, as "yyyy-MM-dd". Turning days into instants happens once,
 * in `exceptionToInstants`, through TZDate in the clinic timezone.
 */
export const DateRangeField = ({
  startDate,
  endDate,
  onChange,
  id,
  disabled,
  "aria-invalid": ariaInvalid,
}: DateRangeFieldProps) => {
  const from = startDate ? parseISO(startDate) : undefined;
  const to = endDate ? parseISO(endDate) : undefined;

  const label = !startDate
    ? null
    : startDate === endDate || !endDate
      ? formatCalendarDate(startDate)
      : `${formatCalendarDate(startDate)} → ${formatCalendarDate(endDate)}`;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            size="lg"
            disabled={disabled}
            aria-invalid={ariaInvalid}
            className="w-full justify-between font-normal tabular-nums"
          />
        }
      >
        {label ?? (
          <span className="text-muted-foreground">
            {EXCEPTION_COPY.datesPlaceholder}
          </span>
        )}
        <CalendarIcon className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="range"
          locale={fr}
          weekStartsOn={WEEK_STARTS_ON}
          defaultMonth={from ?? clinicNow()}
          selected={from ? { from, to } : undefined}
          onSelect={(range) => {
            const nextFrom = range?.from;
            onChange({
              startDate: nextFrom ? format(nextFrom, "yyyy-MM-dd") : "",
              endDate: nextFrom
                ? format(range.to ?? nextFrom, "yyyy-MM-dd")
                : "",
            });
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
