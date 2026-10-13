import { cn } from "@/lib/utils";
import { splitVisibleTeeth } from "@/modules/treatments/teeth";
import { IMAGING_COPY as COPY } from "../constants";

interface ToothChipsProps {
  teeth: readonly string[];
  /** Chips before «+N»; every tooth when omitted. */
  max?: number;
  className?: string;
}

/**
 * «16» «26» «+2» — the FDI codes an image is tagged with. The split is the
 * actes grid's own (`splitVisibleTeeth`), so «+N» reads the same everywhere.
 * Opaque chips on `background`: they sit on a tile's scrim as well as on a
 * panel, in light and dark.
 */
const ToothChips = ({ teeth, max, className }: ToothChipsProps) => {
  if (teeth.length === 0) return null;
  const { visible, hidden } = splitVisibleTeeth(teeth, max ?? teeth.length);

  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {visible.map((tooth) => (
        <span
          key={tooth}
          className="bg-background text-foreground rounded-sm px-1.5 py-0.5 text-[0.6875rem] leading-none font-medium tabular-nums"
        >
          {tooth}
        </span>
      ))}
      {hidden > 0 && (
        <span className="bg-background text-muted-foreground rounded-sm px-1.5 py-0.5 text-[0.6875rem] leading-none font-medium tabular-nums">
          {COPY.moreTeeth(hidden)}
        </span>
      )}
    </span>
  );
};

export default ToothChips;
