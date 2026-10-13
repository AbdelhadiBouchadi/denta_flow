"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatTooth } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ToothCode } from "@/modules/odontogram/constants";
import { DENTITION_LABELS } from "@/modules/treatments/constants";
import {
  CHART_LAYOUT,
  initialDentition,
  type ArchLayout,
} from "@/modules/treatments/teeth";
import { Dentition } from "@/modules/treatments/types";
import { IMAGING_COPY as COPY } from "../constants";

interface ToothFilterProps {
  value: ToothCode | null;
  onChange: (tooth: ToothCode | null) => void;
}

/**
 * The toolbar's «Dent» filter (prompts/32, decision 4): ONE tooth, picked
 * from the actes' chart layout (`CHART_LAYOUT`, adult / child toggle) in a
 * compact popover. Not `ToothSelect` itself: its arch shortcuts and «Effacer»
 * are multi-select gestures with no meaning for a single-tooth filter. The
 * active tooth is cleared from its chip next to the kind chips.
 */
const ToothFilter = ({ value, onChange }: ToothFilterProps) => {
  // Popover and dentition: view state, not URL state.
  const [open, setOpen] = useState(false);
  const [dentition, setDentition] = useState(() =>
    initialDentition(value ? [value] : []),
  );
  const layout = CHART_LAYOUT[dentition];

  const pick = (tooth: ToothCode) => {
    onChange(tooth === value ? null : tooth);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant={value ? "secondary" : "outline"}
            aria-label={COPY.toothFilterLabel}
            className="shrink-0 rounded-full"
          />
        }
      >
        {value ? formatTooth(value) : COPY.toothFilter}
        <ChevronDownIcon className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="@container flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 p-3"
      >
        <div className="bg-muted inline-flex self-start rounded-lg p-0.5">
          {Object.values(Dentition).map((mode) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={dentition === mode ? "outline" : "ghost"}
              aria-pressed={dentition === mode}
              onClick={() => setDentition(mode)}
              className={cn(dentition !== mode && "text-muted-foreground")}
            >
              {DENTITION_LABELS[mode]}
            </Button>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <ArchRow arch={layout.upper} value={value} onPick={pick} />
          <div aria-hidden="true" className="border-t border-dashed" />
          <ArchRow arch={layout.lower} value={value} onPick={pick} />
        </div>
        <p className="text-muted-foreground text-xs">{COPY.toothFilterHint}</p>
      </PopoverContent>
    </Popover>
  );
};

interface ArchRowProps {
  arch: ArchLayout;
  value: ToothCode | null;
  onPick: (tooth: ToothCode) => void;
}

/** The patient's right on the screen's left, split at the midline. */
const ArchRow = ({ arch, value, onPick }: ArchRowProps) => (
  <div className="flex items-stretch justify-center gap-1">
    {[arch.right, arch.left].map((half, index) => (
      <div key={index} className="contents">
        {index === 1 && <div aria-hidden="true" className="bg-border w-px shrink-0" />}
        <div className="flex min-w-0 flex-1 justify-center gap-0.5">
          {half.map((tooth) => {
            const selected = tooth === value;
            return (
              <button
                key={tooth}
                type="button"
                aria-pressed={selected}
                aria-label={formatTooth(tooth)}
                onClick={() => onPick(tooth)}
                className={cn(
                  "focus-visible:ring-ring/50 flex aspect-square max-w-8 min-w-0 flex-1 items-center justify-center rounded-md border text-[0.6875rem] font-medium tabular-nums outline-none transition-colors focus-visible:ring-3",
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted text-foreground",
                )}
              >
                {tooth}
              </button>
            );
          })}
        </div>
      </div>
    ))}
  </div>
);

export default ToothFilter;
