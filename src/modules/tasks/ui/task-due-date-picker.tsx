"use client";

import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, XIcon } from "lucide-react";
import { useState } from "react";

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
import { cn } from "@/lib/utils";
import { TASK_COPY as COPY } from "../constants";

interface TaskDueDatePickerProps {
  id?: string;
  /** A clinic calendar day "yyyy-MM-dd", or null for no due date. */
  value: string | null;
  onChange: (day: string | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

/**
 * The due date of a task, a calendar day with no zone. The picker's Date is
 * only read for its calendar fields — `format(day, "yyyy-MM-dd")` on the
 * fields the user clicked — so no clock can move the day. Past days stay
 * selectable: a reminder entered late is still valid.
 *
 * Used by the add bar and the edit form — two consumers in this slice only.
 */
export const TaskDueDatePicker = ({
  id,
  value,
  onChange,
  disabled,
  invalid,
  className,
}: TaskDueDatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const day = value && isCalendarDate(value) ? value : null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            size="lg"
            disabled={disabled}
            aria-invalid={invalid}
            aria-label={
              day
                ? `${COPY.dueDateLabel} : ${formatCalendarDate(day)}`
                : COPY.dueDatePlaceholder
            }
            className={cn(
              "min-w-0 justify-between gap-2 font-normal tabular-nums",
              className,
            )}
          />
        }
      >
        <CalendarIcon className="text-muted-foreground" />
        <span className={cn("truncate", !day && "text-muted-foreground")}>
          {day ? formatCalendarDate(day) : COPY.dueDatePlaceholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={fr}
          weekStartsOn={WEEK_STARTS_ON}
          defaultMonth={day ? parseISO(day) : clinicNow()}
          selected={day ? parseISO(day) : undefined}
          onSelect={(picked) => {
            onChange(picked ? format(picked, "yyyy-MM-dd") : null);
            setIsOpen(false);
          }}
        />
        {day && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
            >
              <XIcon />
              {COPY.clearDueDate}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
