"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
  BanknoteIcon,
  CalendarCheckIcon,
  CalendarXIcon,
  ScaleIcon,
  StethoscopeIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react";

import StatusBadge, { type StatusTone } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCalendarDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import {
  GRANULARITY_LABELS,
  KPI_LABELS as L,
  STATISTICS_DELTA_LABELS as D,
  STATISTICS_COPY as COPY,
} from "../constants";
import type { PeriodInput } from "../period";
import {
  formatPercent,
  pointsDelta,
  relativeDelta,
  type Delta,
} from "../rules";
import { useAmountFormat } from "./amounts-visibility";

/**
 * Up is good for every figure but the absence rate: the badge's tone follows
 * what the change MEANS, its label says what it IS. «Nouveau» and «stable»
 * are neutral.
 */
const toneOf = (delta: Delta, higherIsBetter: boolean): StatusTone => {
  if (delta.kind === "stable" || delta.kind === "new") return "neutral";
  return (delta.kind === "up") === higherIsBetter ? "success" : "danger";
};

const KpiCard = ({
  icon: Icon,
  label,
  value,
  caption,
  delta,
  higherIsBetter = true,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  caption: string;
  delta: Delta | null;
  higherIsBetter?: boolean;
}) => (
  <Card className="min-w-0 flex-row items-start gap-3 px-4">
    <span
      aria-hidden="true"
      className="bg-teal-light text-teal-dark flex size-9 shrink-0 items-center justify-center rounded-lg"
    >
      <Icon className="size-4" />
    </span>
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-muted-foreground truncate text-sm">{label}</span>
      <span className="font-heading text-h3 text-foreground truncate tabular-nums">
        {value}
      </span>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {delta && (
          <StatusBadge
            label={delta.label}
            tone={toneOf(delta, higherIsBetter)}
            className="tabular-nums"
          />
        )}
        {delta && (
          <span className="text-muted-foreground text-xs">{D.vsPrevious}</span>
        )}
      </div>
      <span className="text-muted-foreground truncate text-xs">{caption}</span>
    </div>
  </Card>
);

const KPI_GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";

/**
 * The KPI row and the «situation actuelle» balances — `getOverview`. Each
 * figure compares with the period just before; the résultat card exists only
 * when the period has a charge (absent, not zero).
 */
export const KpiCards = ({ input }: { input: PeriodInput }) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.statistics.getOverview.queryOptions(input),
  );
  const amount = useAmountFormat();

  const money = (pair: { current: number; previous: number }) =>
    relativeDelta(pair.current, pair.previous);

  return (
    <div className="flex flex-col gap-4">
      {/* The days the server actually used — never recomputed here. */}
      <p className="text-muted-foreground text-xs tabular-nums">
        {COPY.periodRange(
          formatCalendarDate(data.from),
          formatCalendarDate(data.to),
        )}{" "}
        · {GRANULARITY_LABELS[data.granularity]} ·{" "}
        {COPY.previousRange(
          formatCalendarDate(data.previous.from),
          formatCalendarDate(data.previous.to),
        )}
      </p>
      <div className={KPI_GRID}>
        <KpiCard
          icon={BanknoteIcon}
          label={L.encaisse}
          value={amount.full(data.encaisseCents.current)}
          caption={L.encaisseCaption}
          delta={money(data.encaisseCents)}
        />
        <KpiCard
          icon={StethoscopeIcon}
          label={L.production}
          value={amount.full(data.productionCents.current)}
          caption={L.productionCaption}
          delta={money(data.productionCents)}
        />
        <KpiCard
          icon={CalendarCheckIcon}
          label={L.honores}
          value={data.rendezVousHonores.current}
          caption={L.honoresCaption(data.patientsActifs.current)}
          delta={relativeDelta(
            data.rendezVousHonores.current,
            data.rendezVousHonores.previous,
          )}
        />
        <KpiCard
          icon={UserPlusIcon}
          label={L.nouveaux}
          value={data.nouveauxPatients.current}
          caption={L.nouveauxCaption}
          delta={relativeDelta(
            data.nouveauxPatients.current,
            data.nouveauxPatients.previous,
          )}
        />
        <KpiCard
          icon={CalendarXIcon}
          label={L.absence}
          value={formatPercent(data.tauxAbsence.current)}
          caption={L.absenceCaption(formatPercent(data.tauxAnnulation.current))}
          delta={pointsDelta(
            data.tauxAbsence.current,
            data.tauxAbsence.previous,
          )}
          higherIsBetter={false}
        />
        {data.resultatCents && data.chargesCents && (
          <KpiCard
            icon={ScaleIcon}
            label={L.resultat}
            value={amount.full(data.resultatCents.current)}
            caption={L.resultatCaption(amount.full(data.chargesCents.current))}
            delta={
              data.resultatCents.previous === null
                ? null
                : relativeDelta(
                    data.resultatCents.current,
                    data.resultatCents.previous,
                  )
            }
          />
        )}
      </div>

      <Card className="min-w-0 gap-3 px-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Balance
            label={L.outstanding}
            value={amount.full(data.resteAEncaisserCents)}
            className="text-warning-strong"
          />
          <Balance
            label={L.advances}
            value={amount.full(data.avancesCents)}
            className="text-info-strong"
          />
        </div>
        <p className="text-muted-foreground text-xs">{L.balancesCaption}</p>
      </Card>
    </div>
  );
};

const Balance = ({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <span className="text-muted-foreground text-sm">{label}</span>
    <span className={cn("text-lg font-semibold tabular-nums", className)}>
      {value}
    </span>
  </div>
);

/** Same grid and heights as the loaded cards: no layout jump. */
export const KpiCardsLoading = () => (
  <div role="status" aria-label={COPY.loading} className="flex flex-col gap-4">
    <Skeleton className="h-4 w-72 rounded" />
    <div className={KPI_GRID}>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-[126px] rounded-xl" />
      ))}
    </div>
    <Skeleton className="h-[104px] rounded-xl" />
  </div>
);
