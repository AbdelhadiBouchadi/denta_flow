"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatTooth } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ToothCode } from "@/modules/odontogram/constants";
import { DENTITION_LABELS, TOOTH_SELECT_COPY as COPY } from "../constants";
import {
  archTeeth,
  CHART_LAYOUT,
  formatTeethList,
  initialDentition,
  normalizeTeeth,
  type ArchLayout,
} from "../teeth";
import { Dentition } from "../types";

interface ToothSelectProps {
  /** FDI codes. A plain prop: the V1.1 odontogram preselects through it. */
  value: string[];
  onChange: (teeth: string[]) => void;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
}

/**
 * An FDI grid in dental-chart layout: upper arch above lower, the patient's
 * right side on the screen's left (08-clinical.md §1). Multi-select; the
 * Adulte / Enfant toggle only switches which teeth are drawn — a selection in
 * the other dentition is kept (mixed dentition) and listed below the grid.
 */
export const ToothSelect = ({
  value,
  onChange,
  disabled,
  id,
  "aria-invalid": ariaInvalid,
}: ToothSelectProps) => {
  // Which half of the chart is on screen — view state, not form state.
  const [dentition, setDentition] = useState(() => initialDentition(value));
  const selected = new Set(value);
  const layout = CHART_LAYOUT[dentition];

  const emit = (teeth: string[]) => onChange(normalizeTeeth(teeth));
  const toggle = (tooth: ToothCode) =>
    emit(
      selected.has(tooth)
        ? value.filter((code) => code !== tooth)
        : [...value, tooth],
    );
  const addArch = (arch: ArchLayout) => emit([...value, ...archTeeth(arch)]);

  return (
    <div
      id={id}
      role="group"
      aria-label={COPY.groupLabel}
      data-invalid={ariaInvalid ? "" : undefined}
      className="@container flex flex-col gap-3 rounded-lg border p-3 data-invalid:border-destructive"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="bg-muted inline-flex rounded-lg p-0.5">
          {Object.values(Dentition).map((mode) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={dentition === mode ? "outline" : "ghost"}
              aria-pressed={dentition === mode}
              disabled={disabled}
              onClick={() => setDentition(mode)}
              className={cn(dentition !== mode && "text-muted-foreground")}
            >
              {DENTITION_LABELS[mode]}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => addArch(layout.upper)}
          >
            {COPY.upper}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => addArch(layout.lower)}
          >
            {COPY.lower}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled || value.length === 0}
            onClick={() => emit([])}
          >
            {COPY.clear}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <ArchRow
          arch={layout.upper}
          selected={selected}
          onToggle={toggle}
          disabled={disabled}
        />
        <div aria-hidden="true" className="border-t border-dashed" />
        <ArchRow
          arch={layout.lower}
          selected={selected}
          onToggle={toggle}
          disabled={disabled}
        />
      </div>

      <p className="text-muted-foreground text-xs" aria-live="polite">
        {value.length > 0
          ? `${COPY.selection} : ${formatTeethList(value)}`
          : COPY.none}
      </p>
    </div>
  );
};

interface ArchRowProps {
  arch: ArchLayout;
  selected: ReadonlySet<string>;
  onToggle: (tooth: ToothCode) => void;
  disabled?: boolean;
}

/** One arch, split at the midline: the right quadrant, a divider, the left one. */
const ArchRow = ({ arch, selected, onToggle, disabled }: ArchRowProps) => (
  <div className="flex items-stretch justify-center gap-1 @md:gap-1.5">
    <ToothHalf
      teeth={arch.right}
      selected={selected}
      onToggle={onToggle}
      disabled={disabled}
    />
    <div aria-hidden="true" className="bg-border w-px shrink-0" />
    <ToothHalf
      teeth={arch.left}
      selected={selected}
      onToggle={onToggle}
      disabled={disabled}
    />
  </div>
);

const ToothHalf = ({
  teeth,
  selected,
  onToggle,
  disabled,
}: Omit<ArchRowProps, "arch"> & { teeth: ToothCode[] }) => (
  <div className="flex min-w-0 flex-1 justify-center gap-0.5 @md:gap-1">
    {teeth.map((tooth) => {
      const isSelected = selected.has(tooth);
      return (
        <button
          key={tooth}
          type="button"
          aria-pressed={isSelected}
          aria-label={formatTooth(tooth)}
          disabled={disabled}
          onClick={() => onToggle(tooth)}
          className={cn(
            // Fluid below 28rem of form width, so 8 teeth per side fit a
            // phone-width drawer; fixed squares from there.
            "focus-visible:ring-ring/50 flex aspect-square min-w-0 max-w-9 flex-1 items-center justify-center rounded-md border text-[0.6875rem] font-medium tabular-nums outline-none transition-colors focus-visible:ring-3 disabled:opacity-50 @md:text-xs",
            isSelected
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-muted text-foreground",
          )}
        >
          {tooth}
        </button>
      );
    })}
  </div>
);
