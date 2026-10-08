"use client";

import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import {
  ArmchairIcon,
  BanknoteIcon,
  CalendarCheckIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useErrorBoundary } from "react-error-boundary";

import ErrorState from "@/components/shared/error-state";
import MaskedAmount from "@/components/shared/masked-amount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_COPY as COPY,
  remainingHint,
  waitingHint,
} from "../../constants";
import {
  useAdminStats,
  useDashboardStats,
} from "../../hooks/use-dashboard-queries";
import { FinanceBlock } from "../finance-block";
import { GreetingBanner } from "../greeting-banner";
import { StatCard } from "../stat-card";
import { TodayAgenda } from "../today-agenda";
import { TopDebtors } from "../top-debtors";

interface DashboardViewProps {
  /**
   * Decided by the server page from the session role — the client never
   * guesses who is admin. `false` ⇒ no admin card, no admin block, and no
   * request to `getAdminStats` is ever made. Cosmetic still: the procedure
   * refuses a non-admin on its own.
   */
  isAdmin: boolean;
}

/** Two cards for staff, three for the admin — the grid follows, no empty slot. */
const kpiGridClass = (isAdmin: boolean) =>
  cn("grid gap-4 sm:grid-cols-2", isAdmin && "lg:grid-cols-3");

/**
 * `/tableau-de-bord`. Every figure is the server's: counts and balances come
 * from SQL, the day from the clinic clock at each call. The view only lays
 * them out.
 */
const DashboardView = ({ isAdmin }: DashboardViewProps) => {
  const { data: stats } = useDashboardStats();

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <GreetingBanner stats={stats} />

      <div className={kpiGridClass(isAdmin)}>
        <StatCard
          icon={CalendarCheckIcon}
          label={COPY.todayTotal}
          value={stats.todayTotal}
          hint={remainingHint(stats.todayRemaining)}
        />
        <StatCard
          icon={ArmchairIcon}
          label={COPY.waitingRoom}
          value={stats.waitingCount}
          hint={waitingHint(stats.waitingCount)}
        />
        {isAdmin && <TodayRevenueCard />}
      </div>

      <div className="grid items-start gap-4 md:gap-6 lg:grid-cols-3">
        <TodayAgenda
          appointments={stats.appointments}
          className="lg:col-span-2"
        />
        <div className="flex flex-col gap-4 md:gap-6">
          <TopDebtors debtors={stats.topDebtors} />
          {isAdmin && <FinanceBlock />}
        </div>
      </div>
    </div>
  );
};

/** Reads the same `getAdminStats` entry as «Encaissements»: one query. */
const TodayRevenueCard = () => {
  const { data } = useAdminStats();

  return (
    <StatCard
      icon={BanknoteIcon}
      label={COPY.todayRevenue}
      value={<MaskedAmount cents={data.todayRevenueCents} />}
      hint={COPY.todayRevenueHint}
    />
  );
};

export const DashboardViewLoading = ({ isAdmin }: DashboardViewProps) => (
  <div
    role="status"
    aria-label={COPY.loadingTitle}
    className="flex flex-col gap-4 md:gap-6"
  >
    <Skeleton className="h-32 rounded-xl" />
    <div className={kpiGridClass(isAdmin)}>
      {Array.from({ length: isAdmin ? 3 : 2 }, (_, index) => (
        <Skeleton key={index} className="h-24 rounded-xl" />
      ))}
    </div>
    <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
      <Card className="gap-3 px-4 lg:col-span-2">
        <Skeleton className="h-5 w-56" />
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-12" />
        ))}
      </Card>
      <Card className="gap-3 px-4">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-8" />
        ))}
      </Card>
    </div>
    <span className="sr-only">{COPY.loadingDescription}</span>
  </div>
);

/**
 * Rendered by the page's ErrorBoundary. «Réessayer» clears the failed query
 * first — otherwise `useSuspenseQuery` would rethrow the cached error — then
 * resets the boundary, which re-renders the view and refetches.
 */
export const DashboardViewError = () => {
  const { resetBoundary } = useErrorBoundary();
  const { reset } = useQueryErrorResetBoundary();

  return (
    <div className="flex flex-1 flex-col items-center gap-4">
      <ErrorState title={COPY.errorTitle} description={COPY.errorDescription} />
      <Button
        variant="outline"
        onClick={() => {
          reset();
          resetBoundary();
        }}
      >
        <RotateCcwIcon />
        {COPY.retry}
      </Button>
    </div>
  );
};

export default DashboardView;
