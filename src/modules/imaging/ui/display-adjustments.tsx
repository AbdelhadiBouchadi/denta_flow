"use client";

import { SlidersHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { IMAGING_COPY as COPY } from "../constants";

/**
 * Display-only brightness / contrast, shared by the viewer and the compare
 * view: never persisted, never applied to the stored file. 100 % is the
 * image as stored.
 */

export const DEFAULT_LEVEL = 100;

/** The CSS `filter` an `<img>` gets for the current adjustments. */
export const adjustmentFilter = (
  brightness: number,
  contrast: number,
  inverted: boolean,
) =>
  `brightness(${brightness}%) contrast(${contrast}%)${inverted ? " invert(1)" : ""}`;

interface AdjustmentsPopoverProps {
  brightness: number;
  contrast: number;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
}

export const AdjustmentsPopover = ({
  brightness,
  contrast,
  onBrightnessChange,
  onContrastChange,
}: AdjustmentsPopoverProps) => (
  <Popover>
    <PopoverTrigger
      render={<Button variant="ghost" size="icon-lg" aria-label={COPY.adjustments} />}
    >
      <SlidersHorizontalIcon />
    </PopoverTrigger>
    <PopoverContent className="flex w-64 flex-col gap-4">
      <LevelSlider label={COPY.brightness} value={brightness} onChange={onBrightnessChange} />
      <LevelSlider label={COPY.contrast} value={contrast} onChange={onContrastChange} />
      <p className="text-muted-foreground text-xs">{COPY.adjustmentsNote}</p>
    </PopoverContent>
  </Popover>
);

interface LevelSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

/** 0–200 %, 100 % being the image as stored. */
const LevelSlider = ({ label, value, onChange }: LevelSliderProps) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className="text-muted-foreground tabular-nums">{`${value} %`}</span>
    </div>
    <Slider
      min={0}
      max={200}
      step={5}
      value={[value]}
      onValueChange={(next) => {
        const [level] = Array.isArray(next) ? next : [next];
        if (typeof level === "number") onChange(level);
      }}
      aria-label={label}
    />
  </div>
);
