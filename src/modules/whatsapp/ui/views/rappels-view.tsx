"use client";

import {
  useQueryErrorResetBoundary,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { ChevronRightIcon, RotateCcwIcon } from "lucide-react";
import { useTransition } from "react";
import type { FallbackProps } from "react-error-boundary";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import DayFilter from "@/components/shared/day-filter";
import EmptyState from "@/components/shared/empty-state";
import ErrorState from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { addCalendarDays, toClinicDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import {
  RAPPELS_FILTER_LABELS,
  RAPPELS_FILTER_VALUES,
  WHATSAPP_COPY as COPY,
} from "../../constants";
import { useWhatsappFilters } from "../../hooks/use-whatsapp-filters";
import { byDayQueryInput } from "../../query-inputs";
import {
  RappelsFilter,
  WhatsappMessageStatus as S,
  WhatsappMode,
  type WhatsappDayRow,
} from "../../types";
import { ModeBanner } from "../mode-banner";
import { useOpenManual } from "../rappel-actions";
import { columns } from "../rappels-columns";

/** Which rows each chip keeps. «Non planifié» rows only show under «Tous». */
const FILTERS: Record<RappelsFilter, (row: WhatsappDayRow) => boolean> = {
  [RappelsFilter.All]: () => true,
  [RappelsFilter.Scheduled]: (row) => row.status === S.Scheduled || row.status === S.Sending,
  [RappelsFilter.Sent]: (row) => row.status === S.Sent || row.status === S.ManualOpened,
  [RappelsFilter.Delivered]: (row) => row.status === S.Delivered || row.status === S.Read,
  [RappelsFilter.NeedsAttention]: (row) =>
    row.status === S.NeedsAttention || row.status === S.Failed,
};

/**
 * `/rappels` — the day's WhatsApp messages for every staff member. The day
 * defaults to tomorrow (`day` "" in the URL, resolved by the server on the
 * clinic clock); «À vérifier» is reachable from the dashboard through
 * `?status=needs_attention`.
 */
const RappelsView = () => {
  const trpc = useTRPC();
  const [filters, setFilters] = useWhatsappFilters();
  const [isPending, startTransition] = useTransition();
  const { data } = useSuspenseQuery(
    trpc.whatsapp.getByDay.queryOptions(byDayQueryInput(filters)),
  );
  const openManual = useOpenManual();

  const today = toClinicDate(new Date());
  const tomorrow = addCalendarDays(today, 1);
  // Tomorrow is the URL default: "" keeps the prefetched key.
  const goTo = (day: string) =>
    startTransition(() => {
      void setFilters({ day: day === tomorrow ? "" : day });
    });

  const rows = data.items.filter(FILTERS[filters.status]);
  const nextToOpen = data.items.find(
    (row) => row.waLink && row.messageId && row.status !== S.ManualOpened,
  );

  const openNext = () => {
    if (!nextToOpen?.waLink || !nextToOpen.messageId) {
      toast.info(COPY.nextNone);
      return;
    }
    // Synchronous, inside the click: no popup blocker objects.
    window.open(nextToOpen.waLink, "_blank", "noopener,noreferrer");
    openManual.mutate({ id: nextToOpen.messageId });
  };

  const summary = [
    { label: COPY.summaryScheduled, value: data.counts.scheduled },
    { label: COPY.summarySent, value: data.counts.sent },
    { label: COPY.summaryDelivered, value: data.counts.delivered },
    { label: COPY.summaryAttention, value: data.counts.attention, alert: true },
  ];

  return (
    <div
      data-pending={isPending ? "" : undefined}
      className="flex min-w-0 flex-1 flex-col gap-4 px-4 pb-4 data-pending:opacity-70 md:px-8"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" className="flex rounded-lg border p-0.5">
          {[
            { day: today, label: COPY.today },
            { day: tomorrow, label: COPY.tomorrow },
          ].map((option) => (
            <Button
              key={option.label}
              size="sm"
              variant={data.day === option.day ? "secondary" : "ghost"}
              aria-pressed={data.day === option.day}
              onClick={() => goTo(option.day)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <DayFilter label={COPY.dayLabel} value={data.day} onChange={(day) => day && goTo(day)} />
        {data.mode === WhatsappMode.Manual && (
          <Button size="sm" className="ml-auto" onClick={openNext}>
            {COPY.next}
            <ChevronRightIcon />
          </Button>
        )}
      </div>

      <ModeBanner mode={data.mode} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summary.map((item) => (
          <Card
            key={item.label}
            className={cn(
              "gap-0.5 px-4 py-3",
              item.alert && item.value > 0 && "border-warning/50 bg-warning-subtle",
            )}
          >
            <span className="text-muted-foreground text-xs">{item.label}</span>
            <span
              className={cn(
                "font-heading text-h3 tabular-nums",
                item.alert && item.value > 0 ? "text-warning-strong" : "text-foreground",
              )}
            >
              {item.value}
            </span>
          </Card>
        ))}
      </div>

      <div
        role="group"
        aria-label={COPY.colStatus}
        className="flex [scrollbar-width:none] gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden"
      >
        {RAPPELS_FILTER_VALUES.map((value) => {
          const active = filters.status === value;
          const highlight =
            value === RappelsFilter.NeedsAttention && data.counts.attention > 0;
          return (
            <Button
              key={value}
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              className={cn(
                "shrink-0 rounded-full",
                highlight && !active && "border-warning text-warning-strong",
              )}
              onClick={() =>
                startTransition(() => {
                  void setFilters({ status: value });
                })
              }
            >
              {RAPPELS_FILTER_LABELS[value]}
              {highlight && (
                <span className="tabular-nums">({data.counts.attention})</span>
              )}
            </Button>
          );
        })}
      </div>

      {data.items.length === 0 ? (
        <div className="py-10">
          <EmptyState title={COPY.emptyDay} description={COPY.emptyDayDescription} />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-10">
          <EmptyState title={COPY.emptyFilter} description={COPY.emptyDayDescription} />
        </div>
      ) : (
        <DataTable columns={columns} data={rows} />
      )}
    </div>
  );
};

export const RappelsViewLoading = () => (
  <div
    role="status"
    aria-label={COPY.loadingTitle}
    className="flex flex-col gap-4 px-4 pb-4 md:px-8"
  >
    <Skeleton className="h-9 w-72" />
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-16 rounded-xl" />
      ))}
    </div>
    <Skeleton className="h-8 w-96 max-w-full" />
    {Array.from({ length: 6 }, (_, index) => (
      <Skeleton key={index} className="h-12" />
    ))}
    <span className="sr-only">{COPY.loadingDescription}</span>
  </div>
);

/** Clears the failed query before resetting, or the retry rethrows it. */
export const RappelsViewError = ({ resetErrorBoundary }: FallbackProps) => {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <div className="flex flex-1 flex-col items-center gap-4 px-4 py-10">
      <ErrorState title={COPY.errorTitle} description={COPY.errorDescription} />
      <Button
        variant="outline"
        onClick={() => {
          reset();
          resetErrorBoundary();
        }}
      >
        <RotateCcwIcon />
        {COPY.retryLoad}
      </Button>
    </div>
  );
};

export default RappelsView;
