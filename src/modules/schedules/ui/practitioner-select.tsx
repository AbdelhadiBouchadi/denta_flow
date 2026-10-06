"use client";

import type { CSSProperties } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Practitioner } from "../types";

interface PractitionerSelectProps {
  practitioners: Practitioner[];
  value: string;
  onChange: (practitionerId: string) => void;
  id?: string;
  disabled?: boolean;
}

/** One active practitioner at a time, each with their agenda tint. */
export const PractitionerSelect = ({
  practitioners,
  value,
  onChange,
  id,
  disabled,
}: PractitionerSelectProps) => {
  const items = practitioners.map((practitioner) => ({
    value: practitioner.id,
    label: practitioner.name,
  }));

  return (
    <Select
      id={id}
      value={value}
      onValueChange={(next) => next && onChange(next)}
      disabled={disabled}
      items={items}
    >
      <SelectTrigger size="default" className="h-9 w-full sm:w-72">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {practitioners.map((practitioner) => (
          <SelectItem key={practitioner.id} value={practitioner.id}>
            <span
              aria-hidden="true"
              style={{ "--tint": practitioner.color } as CSSProperties}
              className="size-2.5 shrink-0 rounded-full bg-[var(--tint)]"
            />
            {practitioner.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
