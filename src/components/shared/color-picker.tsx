"use client";

import { CheckIcon } from "lucide-react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { COLOR_PALETTE } from "./color-palette";

export { COLOR_PALETTE };

/** A row saved before the palette existed (a seed value) keeps its colour. */
const CURRENT_COLOR_LABEL = "Couleur actuelle";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-labelledby"?: string;
}

/**
 * Swatches only: no free hex field, so every new colour comes from the design
 * system. A value outside the palette is shown first and stays selectable, so
 * opening a form never silently changes what was saved.
 */
export const ColorPicker = ({
  value,
  onChange,
  id,
  disabled,
  "aria-invalid": ariaInvalid,
  "aria-labelledby": ariaLabelledBy,
}: ColorPickerProps) => {
  const normalised = value.toUpperCase();
  const isCustom =
    normalised !== "" &&
    !COLOR_PALETTE.some((swatch) => swatch.value === normalised);

  const swatches = isCustom
    ? [{ value: normalised, label: CURRENT_COLOR_LABEL }, ...COLOR_PALETTE]
    : COLOR_PALETTE;

  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={ariaLabelledBy}
      aria-invalid={ariaInvalid}
      className="flex flex-wrap gap-2"
    >
      {swatches.map((swatch) => {
        const isSelected = swatch.value === normalised;

        return (
          <button
            key={swatch.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={swatch.label}
            title={swatch.label}
            disabled={disabled}
            onClick={() => onChange(swatch.value)}
            style={{ "--swatch": swatch.value } as CSSProperties}
            className={cn(
              "ring-offset-background focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-full bg-[var(--swatch)] transition-shadow outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
              isSelected && "ring-ring ring-2 ring-offset-2",
            )}
          >
            {isSelected && (
              <CheckIcon
                aria-hidden="true"
                className="text-primary-foreground size-4"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
