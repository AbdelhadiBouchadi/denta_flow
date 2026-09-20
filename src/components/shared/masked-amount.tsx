"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDH } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * An amount behind an eye toggle, for figures that sit on screen while a
 * patient waits at the desk — the day's takings, a total owed, a revenue tile.
 *
 * Hidden by default: the point is that nothing is readable over the
 * receptionist's shoulder until she chooses to reveal it. The state is local
 * and deliberately not remembered — every page load starts masked.
 */
interface MaskedAmountProps {
  /** Integer centimes. */
  cents: number;
  className?: string;
}

const MASK = "••• •••";

const MaskedAmount = ({ cents, className }: MaskedAmountProps) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="tabular-nums" aria-live="polite">
        {isVisible ? formatDH(cents) : MASK}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={isVisible ? "Masquer le montant" : "Afficher le montant"}
        aria-pressed={isVisible}
        onClick={() => setIsVisible((previous) => !previous)}
      >
        {isVisible ? (
          <EyeOffIcon className="text-muted-foreground" />
        ) : (
          <EyeIcon className="text-muted-foreground" />
        )}
      </Button>
    </span>
  );
};

export default MaskedAmount;
