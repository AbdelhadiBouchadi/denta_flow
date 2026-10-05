"use client";

import { CheckIcon } from "lucide-react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/**
 * The design-system palette (06-ui.md §1), as swatches. Staff use it for their
 * agenda tint; tags will reuse it (branch 13).
 *
 * These are the one place a hex sits in a component, and on purpose: they are
 * not styling but the values written to a `color` column, which the agenda and
 * printed documents read back as data. A CSS variable cannot be stored, and a
 * token re-themed for dark mode would repaint saved rows. Each value is the
 * light-theme hex of the token named beside it. Upper-case, matching the
 * schema's normalisation.
 */
export const COLOR_PALETTE = [
  { value: "#0D9488", label: "Sarcelle" }, // --teal
  { value: "#0F766E", label: "Sarcelle foncé" }, // --teal-dark
  { value: "#2563EB", label: "Bleu" }, // --info
  { value: "#16A34A", label: "Vert" }, // --success
  { value: "#D97706", label: "Ambre" }, // --warning
  { value: "#DC2626", label: "Rouge" }, // --danger
  { value: "#1E293B", label: "Ardoise" }, // --slate-blue
  { value: "#475569", label: "Gris ardoise" }, // --ink-secondary
] as const;

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
