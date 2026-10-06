"use client";

import { CopyIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  rangeCountLabel,
  WEEK_COPY,
  WEEKDAY_LABELS,
  WEEKDAYS,
  type Weekday,
} from "../constants";

interface CopyDayPopoverProps {
  source: Weekday;
  /** How many ranges each day holds right now, for the checkbox hints. */
  rangeCounts: Record<Weekday, number>;
  onApply: (targets: Weekday[]) => void;
  disabled?: boolean;
}

/**
 * «Copier vers…»: pick the days that take this day's ranges. Their current
 * ranges are replaced in the form only — nothing is saved until
 * «Enregistrer».
 */
export const CopyDayPopover = ({
  source,
  rangeCounts,
  onApply,
  disabled,
}: CopyDayPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<Weekday[]>([]);

  const toggle = (weekday: Weekday, checked: boolean) =>
    setTargets((current) =>
      checked
        ? [...current, weekday]
        : current.filter((value) => value !== weekday),
    );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTargets([]);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label={`${WEEK_COPY.copyTo} (${WEEKDAY_LABELS[source]})`}
          />
        }
      >
        <CopyIcon />
        {WEEK_COPY.copyTo}
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-64 flex-col gap-3">
        <p className="text-foreground text-sm font-medium">
          {WEEK_COPY.copyToTitle}
        </p>
        <ul className="flex flex-col gap-2">
          {WEEKDAYS.filter((weekday) => weekday !== source).map((weekday) => {
            const id = `copy-${source}-to-${weekday}`;
            return (
              <li key={weekday} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={targets.includes(weekday)}
                  onCheckedChange={(checked) => toggle(weekday, checked)}
                />
                <label
                  htmlFor={id}
                  className="text-foreground flex flex-1 justify-between gap-2 text-sm"
                >
                  {WEEKDAY_LABELS[weekday]}
                  <span className="text-muted-foreground">
                    {rangeCountLabel(rangeCounts[weekday])}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <Button
          type="button"
          size="sm"
          disabled={targets.length === 0}
          onClick={() => {
            onApply(targets);
            setOpen(false);
            setTargets([]);
          }}
        >
          {WEEK_COPY.copyApply}
        </Button>
      </PopoverContent>
    </Popover>
  );
};
