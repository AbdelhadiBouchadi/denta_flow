"use client";

import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WEEK_STARTS_ON } from "@/constants";
import { addCalendarDays } from "@/lib/time";
import { ACTIVITY_COPY as COPY } from "../constants";
import type { ActivityStaffOption } from "../types";
import { weekStartOf } from "../week";

interface Props {
  selected: string;
  today: string;
  staff: string;
  staffOptions: ActivityStaffOption[];
  onDayChange: (day: string) => void;
  onStaffChange: (staffId: string) => void;
}

/**
 * Week navigation (previous / next WEEK, «Aujourd’hui», a picker for far
 * jumps) and the staff filter. Every control writes the URL; nothing here
 * holds state of its own. The future is unreachable: the next arrow stops at
 * the current week and lands on today at most, the picker greys it out.
 */
const ActivityToolbar = ({
  selected,
  today,
  staff,
  staffOptions,
  onDayChange,
  onStaffChange,
}: Props) => {
  const nextWeekStart = addCalendarDays(weekStartOf(selected), 7);
  const canGoNext = nextWeekStart <= today;
  const nextDay = addCalendarDays(selected, 7);

  const staffItems = [
    { label: COPY.allStaff, value: null },
    ...staffOptions.map((option) => ({
      label: option.isActive ? option.name : COPY.inactiveStaff(option.name),
      value: option.id,
    })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={COPY.previousWeek}
          onClick={() => onDayChange(addCalendarDays(selected, -7))}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={COPY.nextWeek}
          disabled={!canGoNext}
          onClick={() => onDayChange(nextDay > today ? today : nextDay)}
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <Button
        variant="outline"
        size="lg"
        disabled={selected === today}
        onClick={() => onDayChange(today)}
      >
        {COPY.today}
      </Button>

      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="lg"
              aria-label={COPY.pickDate}
              className="font-normal capitalize tabular-nums"
            />
          }
        >
          <CalendarIcon className="text-muted-foreground" />
          {format(parseISO(selected), "EEEE d MMMM yyyy", { locale: fr })}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            locale={fr}
            weekStartsOn={WEEK_STARTS_ON}
            defaultMonth={parseISO(selected)}
            selected={parseISO(selected)}
            disabled={{ after: parseISO(today) }}
            // Only the picked day's calendar fields are read — never an instant.
            onSelect={(picked) => {
              if (picked) onDayChange(format(picked, "yyyy-MM-dd"));
            }}
          />
        </PopoverContent>
      </Popover>

      <Select
        value={staff || null}
        onValueChange={(value) => onStaffChange(value ?? "")}
        items={staffItems}
      >
        <SelectTrigger
          size="default"
          aria-label={COPY.staffLabel}
          className="h-9 w-full min-w-48 sm:w-auto"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {staffItems.map((item) => (
            <SelectItem key={item.value ?? "all"} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ActivityToolbar;
