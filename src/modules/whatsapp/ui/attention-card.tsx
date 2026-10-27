import { ChevronRightIcon, MessageCircleWarningIcon } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { WHATSAPP_COPY as COPY } from "../constants";
import { RappelsFilter } from "../types";

/**
 * The dashboard's «Messages WhatsApp à vérifier» card. The count comes from
 * `dashboard.getStats` (the slice's `attentionCountQuery`, inside the
 * dashboard's own batch); the link opens «Rappels» on the «À vérifier» chip.
 */
export const WhatsappAttentionCard = ({ count }: { count: number }) => (
  <Link
    href={`/rappels?status=${RappelsFilter.NeedsAttention}`}
    className="focus-visible:ring-ring/50 rounded-xl outline-none focus-visible:ring-3"
  >
    <Card className="border-warning/50 bg-warning-subtle hover:bg-warning-subtle/80 flex-row items-center gap-4 px-4 transition-colors">
      <span
        aria-hidden="true"
        className="bg-warning text-background flex size-10 shrink-0 items-center justify-center rounded-lg"
      >
        <MessageCircleWarningIcon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-warning-strong text-sm font-medium">
          {COPY.dashboardCard}
        </span>
        <span className="text-warning-strong/80 text-xs">{COPY.dashboardHint}</span>
      </div>
      <span className="font-heading text-h3 text-warning-strong tabular-nums">
        {count}
      </span>
      <ChevronRightIcon className="text-warning-strong size-5 shrink-0" />
    </Card>
  </Link>
);
