import type { CSSProperties } from "react";

import { minutesToWallClock, wallClockToMinutes } from "@/lib/time";
import {
  APPOINTMENT_TYPE_COPY,
  formatDuration,
  PREVIEW_START,
} from "../constants";

interface AgendaBlockPreviewProps {
  label: string;
  /** A stored palette value — data, carried into CSS as a variable. */
  color: string;
  durationMinutes: number;
}

/**
 * What a booking of this type looks like on the agenda: a tinted block with a
 * solid edge in the type's colour. The tint is mixed against the card token,
 * so it reads in both themes without a second hex.
 */
export const AgendaBlockPreview = ({
  label,
  color,
  durationMinutes,
}: AgendaBlockPreviewProps) => {
  const start = wallClockToMinutes(PREVIEW_START);
  // The preview stays inside one day whatever the field holds mid-typing.
  const duration = Number.isFinite(durationMinutes)
    ? Math.min(Math.max(durationMinutes, 0), 24 * 60 - 1 - start)
    : 0;

  return (
    <div
      style={{ "--type-color": color } as CSSProperties}
      className="text-foreground flex min-h-16 flex-col gap-0.5 rounded-md border-l-4 border-l-[var(--type-color)] bg-[color-mix(in_oklab,var(--type-color)_14%,var(--card))] px-3 py-2"
    >
      <span className="text-foreground-secondary text-xs tabular-nums">
        {PREVIEW_START} – {minutesToWallClock(start + duration)}
        {duration > 0 && ` · ${formatDuration(duration)}`}
      </span>
      <span className="truncate text-sm font-semibold">
        {APPOINTMENT_TYPE_COPY.previewPatient}
      </span>
      <span className="truncate text-xs font-medium text-[var(--type-color)]">
        {label}
      </span>
    </div>
  );
};
