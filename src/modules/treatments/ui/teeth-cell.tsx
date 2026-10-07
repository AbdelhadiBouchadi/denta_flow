"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { moreTeethLabel, TREATMENT_COPY } from "../constants";
import { formatTeethList, splitVisibleTeeth } from "../teeth";

/**
 * «Dent 26, Dent 27». Beyond three teeth: the first three and «+N», with the
 * full list in a tooltip. An acte with no tooth shows a muted dash.
 */
export const TeethCell = ({ teeth }: { teeth: readonly string[] }) => {
  if (teeth.length === 0) {
    return (
      <span className="text-muted-foreground">{TREATMENT_COPY.noTeeth}</span>
    );
  }

  const { visible, hidden } = splitVisibleTeeth(teeth);
  if (hidden === 0) {
    return <span className="tabular-nums">{formatTeethList(teeth)}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className="cursor-default tabular-nums underline decoration-dotted underline-offset-4"
          />
        }
      >
        {formatTeethList(visible)}{" "}
        <span className="text-muted-foreground">{moreTeethLabel(hidden)}</span>
      </TooltipTrigger>
      <TooltipContent>{formatTeethList(teeth)}</TooltipContent>
    </Tooltip>
  );
};
