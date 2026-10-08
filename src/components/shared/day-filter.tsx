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
import { formatCalendarDate } from "@/lib/format";
import { clinicNow, isCalendarDate } from "@/lib/time";

interface DayFilterProps {
  /** «Du», «Au» — from the caller's slice constants. */
  label: string;
  /** A clinic calendar day "yyyy-MM-dd", or "" for open-ended. */
  value: string;
  onChange: (day: string) => void;
}

/**
 * One end of a list's date range, a clinic calendar day ("" ⇒ open). The
 * picker's Date is only read for its calendar fields; the procedure turns the
 * day into clinic-midnight instants through TZDate. Shared by `/actes` and
 * `/paiements`.
 */
const DayFilter = ({ label, value, onChange }: DayFilterProps) => {
  const day = isCalendarDate(value) ? value : "";

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="lg"
            className="min-w-36 justify-between font-normal tabular-nums"
          />
        }
      >
        <span>
          <span className="text-muted-foreground">{label} </span>
          {day ? formatCalendarDate(day) : "—"}
        </span>
        <CalendarIcon className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          locale={fr}
          weekStartsOn={WEEK_STARTS_ON}
          defaultMonth={day ? parseISO(day) : clinicNow()}
          selected={day ? parseISO(day) : undefined}
          onSelect={(picked) =>
            onChange(picked ? format(picked, "yyyy-MM-dd") : "")
          }
        />
      </PopoverContent>
    </Popover>
  );
};

export default DayFilter;
