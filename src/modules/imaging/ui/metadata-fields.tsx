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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WEEK_STARTS_ON } from "@/constants";
import { formatCalendarDate } from "@/lib/format";
import { clinicNow, toClinicDate } from "@/lib/time";
import { IMAGING_COPY as COPY, PATIENT_FILE_KIND_OPTIONS } from "../constants";
import type { PatientFileKind } from "../types";

/**
 * The two non-text controls of an image's metadata, shared by the upload
 * rows and the viewer's edit form. Controlled inputs only: each sits inside
 * a react-hook-form `Controller`, which owns the value and the error.
 */

interface KindSelectProps {
  id: string;
  value: PatientFileKind;
  onChange: (value: PatientFileKind) => void;
  disabled?: boolean;
  invalid?: boolean;
}

export const KindSelect = ({
  id,
  value,
  onChange,
  disabled,
  invalid,
}: KindSelectProps) => (
  <Select
    id={id}
    value={value}
    onValueChange={(next) => next && onChange(next as PatientFileKind)}
    disabled={disabled}
    items={PATIENT_FILE_KIND_OPTIONS}
  >
    <SelectTrigger
      size="default"
      aria-invalid={invalid}
      className="h-9 w-full min-w-0"
    >
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {PATIENT_FILE_KIND_OPTIONS.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

interface TakenDatePickerProps {
  id: string;
  /** A clinic calendar day, "yyyy-MM-dd". */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * The picker's Dates are only read for their calendar fields: the instant is
 * resolved on the server through the clinic timezone. No future day is
 * offered; the schema refuses one again.
 */
export const TakenDatePicker = ({
  id,
  value,
  onChange,
  disabled,
  invalid,
}: TakenDatePickerProps) => (
  <Popover>
    <PopoverTrigger
      render={
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid}
          className="h-9 w-full min-w-0 justify-between font-normal tabular-nums"
        />
      }
    >
      {value ? (
        formatCalendarDate(value)
      ) : (
        <span className="text-muted-foreground">{COPY.pickDate}</span>
      )}
      <CalendarIcon className="text-muted-foreground" />
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0">
      <Calendar
        mode="single"
        locale={fr}
        weekStartsOn={WEEK_STARTS_ON}
        defaultMonth={value ? parseISO(value) : clinicNow()}
        selected={value ? parseISO(value) : undefined}
        disabled={{ after: parseISO(toClinicDate(clinicNow())) }}
        onSelect={(day) => day && onChange(format(day, "yyyy-MM-dd"))}
      />
    </PopoverContent>
  </Popover>
);
