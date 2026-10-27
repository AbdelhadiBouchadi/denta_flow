"use client";

import StatusBadge from "@/components/shared/status-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SKIP_REASON_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  UNSCHEDULED_LABEL,
  UNSCHEDULED_REASON_LABELS,
} from "../constants";
import type {
  UnscheduledReason,
  WhatsappMessageStatus,
  WhatsappSkipReason,
} from "../types";

interface MessageStatusBadgeProps {
  status: WhatsappMessageStatus | null;
  skipReason?: string | null;
  unscheduledReason?: UnscheduledReason | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

/** Why a row is where it is — the reason or Twilio's error, as one line. */
export const statusDetail = ({
  skipReason,
  unscheduledReason,
  errorCode,
  errorMessage,
}: Omit<MessageStatusBadgeProps, "status">) => {
  if (unscheduledReason) return UNSCHEDULED_REASON_LABELS[unscheduledReason];
  if (skipReason) return SKIP_REASON_LABELS[skipReason as WhatsappSkipReason];
  if (errorCode) return errorMessage ? `${errorCode} — ${errorMessage}` : errorCode;
  return null;
};

/**
 * The message's status pill. Its reason (skip reason, Twilio error) sits in
 * a tooltip AND in the accessible name, so it is never hover-only.
 */
export const MessageStatusBadge = (props: MessageStatusBadgeProps) => {
  const label = props.status ? STATUS_LABELS[props.status] : UNSCHEDULED_LABEL;
  const tone = props.status ? STATUS_TONES[props.status] : "neutral";
  const detail = statusDetail(props);

  if (!detail) return <StatusBadge label={label} tone={tone} />;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            aria-label={`${label} — ${detail}`}
            className="inline-flex cursor-default rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <StatusBadge label={label} tone={tone} />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{detail}</TooltipContent>
    </Tooltip>
  );
};
