"use client";

import StatusBadge from "@/components/shared/status-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { APPROVAL_LABELS, APPROVAL_TONES } from "../constants";
import { TemplateApproval } from "../types";

/**
 * «Brouillon» · «En attente de validation WhatsApp» · «Approuvé» · «Refusé».
 * A refusal carries its reason in a tooltip AND in the accessible name, so
 * it is never hover-only (the card also prints it).
 */
export const ApprovalBadge = ({
  status,
  reason,
}: {
  status: TemplateApproval;
  reason?: string | null;
}) => {
  const label = APPROVAL_LABELS[status];
  const badge = <StatusBadge label={label} tone={APPROVAL_TONES[status]} />;
  if (status !== TemplateApproval.Rejected || !reason) return badge;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            aria-label={`${label} — ${reason}`}
            className="inline-flex cursor-default rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        {badge}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{reason}</TooltipContent>
    </Tooltip>
  );
};
