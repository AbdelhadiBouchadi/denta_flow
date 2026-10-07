"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Accessible names and placeholders — the field has no visible sub-labels. */
const TIME_FIELD_COPY = {
  hour: "Heure",
  minute: "Minutes",
  hourPlaceholder: "hh",
  minutePlaceholder: "mm",
} as const;

const pad2 = (value: number) => String(value).padStart(2, "0");

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
  const value = pad2(hour);
  return { value, label: value };
});

const minuteOptions = (step: number, current: string | null) => {
  const values = Array.from({ length: Math.ceil(60 / step) }, (_, index) =>
    pad2(index * step),
  );
  // A stored value off the step (seeded, or entered before a step change)
  // stays visible and selectable: opening a form never silently changes it.
  if (current && !values.includes(current)) {
    values.push(current);
    values.sort();
  }
  return values.map((value) => ({ value, label: value }));
};

interface TimeFieldProps {
  /** "HH:mm", 24-hour, or "" for no value yet. */
  value: string;
  onChange: (value: string) => void;
  /** The minute select's step. 5 ⇒ 00, 05 … 55. */
  minuteStep?: number;
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  /** Prefixes the two selects' accessible names: «Début — Heure». */
  "aria-label"?: string;
}

/**
 * A clinic wall-clock time: an hour select (00–23) and a minute select.
 *
 * Never `<input type="time">`, which renders AM/PM on some systems and
 * browsers. Always 24-hour, no timezone shown — the value is a wall-clock
 * reading, resolved against a day in the clinic timezone by `src/lib/time.ts`.
 *
 * Picking only one half fills the other with 00, so the value is always
 * either "" or a complete "HH:mm".
 */
export const TimeField = ({
  value,
  onChange,
  minuteStep = 5,
  id,
  disabled,
  className,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
}: TimeFieldProps) => {
  const [hour, minute] = value ? value.split(":") : [null, null];
  const minutes = minuteOptions(minuteStep, minute ?? null);
  const prefix = ariaLabel ? `${ariaLabel} — ` : "";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Select
        id={id}
        value={hour ?? null}
        onValueChange={(next) => next && onChange(`${next}:${minute ?? "00"}`)}
        disabled={disabled}
        items={HOUR_OPTIONS}
      >
        <SelectTrigger
          size="default"
          aria-invalid={ariaInvalid}
          aria-label={`${prefix}${TIME_FIELD_COPY.hour}`}
          className="h-9 w-18 tabular-nums"
        >
          <SelectValue placeholder={TIME_FIELD_COPY.hourPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {HOUR_OPTIONS.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="tabular-nums"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span aria-hidden="true" className="text-muted-foreground font-medium">
        :
      </span>

      <Select
        value={minute ?? null}
        onValueChange={(next) => next && onChange(`${hour ?? "00"}:${next}`)}
        disabled={disabled}
        items={minutes}
      >
        <SelectTrigger
          size="default"
          aria-invalid={ariaInvalid}
          aria-label={`${prefix}${TIME_FIELD_COPY.minute}`}
          className="h-9 w-18 tabular-nums"
        >
          <SelectValue placeholder={TIME_FIELD_COPY.minutePlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {minutes.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="tabular-nums"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
