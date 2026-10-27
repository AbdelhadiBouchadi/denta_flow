import { CheckCheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { CHIP_SAMPLES, WHATSAPP_COPY as COPY } from "../constants";
import { renderSegments, type ChipValues } from "../template-body";
import { MessageChip, type BodySegment } from "../types";

interface MessagePreviewProps {
  segments: readonly BodySegment[];
  /** The clinic's real name and phone; the other values are samples. */
  values?: Partial<ChipValues>;
  className?: string;
}

/**
 * What the patient sees: an incoming WhatsApp bubble on the chat
 * background, with realistic sample values (Karim, mercredi 15 octobre,
 * 14:30) and the clinic's real name and phone. Tokens only — it follows the
 * light and dark themes like the rest of the app.
 */
export const MessagePreview = ({ segments, values, className }: MessagePreviewProps) => {
  const text = renderSegments(segments, { ...CHIP_SAMPLES, ...values }).trim();

  return (
    <figure
      className={cn("bg-muted flex flex-col gap-1 rounded-xl px-3 py-3", className)}
      aria-label={COPY.preview}
    >
      <div className="bg-card text-card-foreground relative max-w-[min(100%,26rem)] self-start rounded-lg rounded-tl-none px-3 pt-2 pb-1.5 shadow-xs ring-1 ring-foreground/5">
        {/* The bubble's tail, drawn with the bubble's own colour. */}
        <span
          aria-hidden="true"
          className="bg-card absolute top-0 -left-1.5 size-3 [clip-path:polygon(0_0,100%_0,100%_100%)]"
        />
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
          {text || "…"}
        </p>
        <span className="text-muted-foreground mt-0.5 flex items-center justify-end gap-1 text-[0.6875rem] tabular-nums">
          {CHIP_SAMPLES[MessageChip.Time]}
          <CheckCheckIcon aria-hidden="true" className="text-info size-3.5" />
        </span>
      </div>
      <figcaption className="text-muted-foreground text-xs">{COPY.previewHelp}</figcaption>
    </figure>
  );
};
