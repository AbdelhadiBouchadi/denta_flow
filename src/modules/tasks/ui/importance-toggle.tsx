"use client";

import { StarIcon } from "lucide-react";

import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { TASK_COPY as COPY } from "../constants";

interface ImportanceToggleProps {
  id?: string;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  disabled?: boolean;
  size?: "default" | "lg";
  className?: string;
}

/**
 * The star. `aria-pressed` carries the state for a screen reader; the label
 * says what pressing does next. The fill is the warning token, never a hex.
 */
export const ImportanceToggle = ({
  id,
  pressed,
  onPressedChange,
  disabled,
  size = "default",
  className,
}: ImportanceToggleProps) => (
  <Toggle
    id={id}
    type="button"
    size={size}
    pressed={pressed}
    onPressedChange={(next) => onPressedChange(next)}
    disabled={disabled}
    aria-label={pressed ? COPY.unmarkImportant : COPY.markImportant}
    title={pressed ? COPY.important : COPY.markImportant}
    // The pressed state is the star's colour, not a grey background.
    className={cn("shrink-0 aria-pressed:bg-transparent", className)}
  >
    <StarIcon
      className={cn(
        pressed ? "fill-warning text-warning" : "text-muted-foreground",
      )}
    />
  </Toggle>
);
