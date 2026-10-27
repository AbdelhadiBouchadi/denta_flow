"use client";

import { CheckCircle2Icon, ChevronDownIcon, CopyIcon, WrenchIcon, XCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatDateTime } from "@/lib/format";
import {
  DIAGNOSTIC_COPY as DIAG,
  MODE_LABELS,
  STATUS_LABELS,
  STATUS_VALUES,
  WHATSAPP_COPY as COPY,
} from "../constants";
import { WhatsappMessageStatus, type WhatsappServiceStatus } from "../types";

/** The counters worth a glance; the journal has the rest. */
const COUNTER_STATUSES: readonly WhatsappMessageStatus[] = STATUS_VALUES.filter(
  (status) =>
    status !== WhatsappMessageStatus.Sending &&
    status !== WhatsappMessageStatus.Canceled,
);

/**
 * «Diagnostic technique (pour le support)» — closed by default, at the bottom
 * of «Connexion». The ONLY clinic-screen component allowed to name env
 * variables, the provider, the scheduled task or the callback address
 * (prompts/33b, decision 3); `copy.test.ts` exempts this file and
 * `DIAGNOSTIC_COPY`, nothing else.
 */
export const DiagnosticPanel = ({ status }: { status: WhatsappServiceStatus }) => {
  const { diagnostic } = status;

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(diagnostic.webhookUrl);
      toast.success(COPY.copied);
    } catch {
      // Clipboard refused (insecure context): the address stays selectable.
    }
  };

  return (
    <Collapsible>
      <Card className="gap-0 p-0">
        <CollapsibleTrigger className="group/diag text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm outline-none focus-visible:ring-3">
          <WrenchIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 font-medium">{DIAG.title}</span>
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform group-data-[panel-open]/diag:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 border-t px-4 py-4 text-sm">
          <p className="text-muted-foreground text-xs">{DIAG.description}</p>

          <p>
            <span className="text-muted-foreground">{DIAG.mode} : </span>
            <span className="text-foreground font-medium">{MODE_LABELS[status.mode]}</span>
          </p>

          <section className="flex flex-col gap-2">
            <h4 className="text-foreground font-medium">{DIAG.envTitle}</h4>
            <ul className="flex flex-col gap-2">
              {diagnostic.env.map((entry) => (
                <li key={entry.key} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="text-foreground block">{DIAG.envLabels[entry.key]}</span>
                    <code className="text-muted-foreground text-xs break-all">{entry.key}</code>
                  </span>
                  <span
                    className={
                      entry.present
                        ? "text-success-strong flex shrink-0 items-center gap-1"
                        : "text-danger-strong flex shrink-0 items-center gap-1"
                    }
                  >
                    {entry.present ? (
                      <CheckCircle2Icon className="size-4" />
                    ) : (
                      <XCircleIcon className="size-4" />
                    )}
                    {entry.present ? DIAG.present : DIAG.missing}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-1 border-t pt-3">
            <span className="text-muted-foreground text-xs">{DIAG.webhookUrl}</span>
            <div className="flex min-w-0 items-center gap-2">
              <code className="bg-muted min-w-0 flex-1 rounded px-2 py-1 text-xs break-all">
                {diagnostic.webhookUrl}
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={COPY.copyText}
                onClick={() => void copyWebhook()}
              >
                <CopyIcon />
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">{DIAG.webhookHelp}</p>
          </section>

          <section className="flex flex-col gap-1 border-t pt-3 tabular-nums">
            <span className="text-muted-foreground text-xs">{DIAG.lastRun}</span>
            {diagnostic.lastCron ? (
              <>
                <span className="text-foreground font-medium">
                  {formatDateTime(diagnostic.lastCron.at)}
                </span>
                <span className="text-muted-foreground">
                  {DIAG.lastRunCounts(
                    diagnostic.lastCron.claimed,
                    diagnostic.lastCron.sent,
                    diagnostic.lastCron.failed,
                    diagnostic.lastCron.needsAttention,
                  )}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">{DIAG.lastRunNever}</span>
            )}
          </section>

          <section className="flex flex-col gap-2 border-t pt-3">
            <h4 className="text-foreground font-medium">{DIAG.counters}</h4>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1">
              <span />
              <span className="text-muted-foreground text-xs">{DIAG.counters24h}</span>
              <span className="text-muted-foreground text-xs">{DIAG.counters7d}</span>
              {COUNTER_STATUSES.map((key) => (
                <div key={key} className="contents">
                  <span className="text-foreground">{STATUS_LABELS[key]}</span>
                  <span className="text-right tabular-nums">{diagnostic.counts24h[key]}</span>
                  <span className="text-right tabular-nums">{diagnostic.counts7d[key]}</span>
                </div>
              ))}
            </div>
          </section>

          <p className="text-muted-foreground border-t pt-3 text-xs">{DIAG.privacyHelp}</p>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
