"use client";

import { BanIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  TAG_COPY,
  TAG_ICON_LABELS,
  TAG_ICON_NAMES,
  TAG_ICONS,
} from "../constants";

interface TagIconPickerProps {
  /** A curated icon name, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-labelledby"?: string;
}

const optionClassName =
  "border-input text-foreground-secondary hover:bg-muted focus-visible:ring-ring/50 flex size-9 items-center justify-center rounded-lg border transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:size-4";

const selectedClassName = "border-primary bg-teal-light text-teal-dark";

/**
 * The curated icons as a radio grid, plus «Aucune». Only names from
 * `TAG_ICONS` can be picked; the schema refuses anything else anyway.
 */
export const TagIconPicker = ({
  value,
  onChange,
  id,
  disabled,
  "aria-invalid": ariaInvalid,
  "aria-labelledby": ariaLabelledBy,
}: TagIconPickerProps) => (
  <div
    id={id}
    role="radiogroup"
    aria-labelledby={ariaLabelledBy}
    aria-invalid={ariaInvalid}
    className="flex flex-wrap gap-1.5"
  >
    <button
      type="button"
      role="radio"
      aria-checked={value === ""}
      aria-label={TAG_COPY.noIcon}
      title={TAG_COPY.noIcon}
      disabled={disabled}
      onClick={() => onChange("")}
      className={cn(optionClassName, value === "" && selectedClassName)}
    >
      <BanIcon aria-hidden="true" />
    </button>

    {TAG_ICON_NAMES.map((name) => {
      const Icon = TAG_ICONS[name];
      const isSelected = value === name;

      return (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={isSelected}
          aria-label={TAG_ICON_LABELS[name]}
          title={TAG_ICON_LABELS[name]}
          disabled={disabled}
          onClick={() => onChange(name)}
          className={cn(optionClassName, isSelected && selectedClassName)}
        >
          <Icon aria-hidden="true" />
        </button>
      );
    })}
  </div>
);
