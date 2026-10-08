"use client";

import { useTransition } from "react";

import MaskedAmount from "@/components/shared/masked-amount";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCalendarDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_COPY as COPY,
  DASHBOARD_PERIOD_OPTIONS,
  paymentCountHint,
} from "../constants";
import { useAdminStats } from "../hooks/use-dashboard-queries";
import { useDashboardFilters } from "../hooks/use-dashboard-filters";
import type { DashboardPeriod } from "../types";

/**
 * «Encaissements» — admins only. Rendered only when the server page says the
 * session is an admin, and `getAdminStats` is an `adminProcedure`: hiding is
 * courtesy, the refusal is the server's.
 *
 * The period lives in the URL (`?period=`). Changing it inside a transition
 * keeps the current figures on screen while the new period loads, instead of
 * dropping the whole dashboard back to its skeleton.
 *
 * Reste à encaisser and Avances are balances as of now — the caption says so,
 * since they do not move with the period.
 */
export const FinanceBlock = () => {
  const { data } = useAdminStats();
  const [{ period }, setFilters] = useDashboardFilters();
  const [isPending, startTransition] = useTransition();

  const changePeriod = (next: DashboardPeriod | null) => {
    if (!next) return;
    startTransition(() => {
      void setFilters({ period: next });
    });
  };

  return (
    <Card
      data-pending={isPending ? "" : undefined}
      className="data-pending:opacity-70"
    >
      <CardHeader>
        <CardTitle className="text-h4">{COPY.financeTitle}</CardTitle>
        <CardAction>
          <Select
            value={period}
            onValueChange={changePeriod}
            items={DASHBOARD_PERIOD_OPTIONS}
          >
            <SelectTrigger
              size="sm"
              aria-label={COPY.periodLabel}
              className="min-w-36"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {DASHBOARD_PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Figure
          label={COPY.periodRevenue}
          hint={`${periodRangeLabel(data.period)} · ${paymentCountHint(data.paymentCount)}`}
          cents={data.revenueCents}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Figure
            label={COPY.outstanding}
            cents={data.outstandingCents}
            className="text-warning-strong"
          />
          <Figure
            label={COPY.advances}
            cents={data.advancesCents}
            className="text-info-strong"
          />
        </div>
      </CardContent>

      <CardFooter>
        <p className="text-muted-foreground text-xs">{COPY.balancesCaption}</p>
      </CardFooter>
    </Card>
  );
};

/** «01/10/2026 – 31/10/2026», or the one day for «Aujourd’hui». */
const periodRangeLabel = ({ from, to }: { from: string; to: string }) =>
  from === to
    ? formatCalendarDate(from)
    : `${formatCalendarDate(from)} – ${formatCalendarDate(to)}`;

const Figure = ({
  label,
  hint,
  cents,
  className,
}: {
  label: string;
  hint?: string;
  cents: number;
  className?: string;
}) => (
  <div className="flex min-w-0 flex-col gap-1">
    <span className="text-muted-foreground text-sm">{label}</span>
    <MaskedAmount
      cents={cents}
      className={cn("text-lg font-semibold", className)}
    />
    {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
  </div>
);
