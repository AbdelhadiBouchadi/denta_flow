"use client";

import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { RotateCcwIcon } from "lucide-react";
import { useTransition } from "react";
import { useErrorBoundary } from "react-error-boundary";

import ErrorState from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CHART_COPY as C,
  STATISTICS_COPY as COPY,
  TOP_ACTES_ORDER_LABELS,
} from "../../constants";
import { TopActesOrder } from "../../types";
import { useStatisticsInput } from "../../hooks/use-statistics-input";
import { AmountsVisibilityProvider } from "../amounts-visibility";
import { AppointmentsChart } from "../appointments-chart";
import { AttendanceHeatmap, WeekdayChart } from "../attendance";
import {
  CategoriesCard,
  InsurersCard,
  PaymentMethodsCard,
} from "../donut-cards";
import { KpiCards, KpiCardsLoading } from "../kpi-cards";
import { PractitionersChart } from "../practitioners-chart";
import { RevenueChart } from "../revenue-chart";
import { RevenueVsChargesChart } from "../revenue-vs-charges-chart";
import {
  BARS_HEIGHT,
  CHART_HEIGHT,
  DONUT_HEIGHT,
  Section,
  SectionBoundary,
} from "../section";
import { StatisticsHeader } from "../statistics-header";
import { TopActesChart } from "../top-actes-chart";

/** One column on phones, two from md, three on xl; children never overflow. */
const ROW = "grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3 *:min-w-0";

/**
 * `/statistiques` — admin only (the page redirects, every procedure
 * refuses). Every section is its own Suspense + ErrorBoundary: it loads,
 * fails and retries alone. Each reads its query with `useSuspenseQuery` and
 * the SAME input the page prefetched (`useStatisticsInput` →
 * `toPeriodInput`), so the first paint makes no `/api/trpc` call.
 *
 * Views take identifiers only: the sections receive the period input — the
 * query key — never data.
 */
const StatisticsView = () => {
  const { input, error } = useStatisticsInput();
  const [isPending, startTransition] = useTransition();

  return (
    <AmountsVisibilityProvider>
      <div className="flex min-w-0 flex-col gap-4 md:gap-6">
        <StatisticsHeader startTransition={startTransition} error={error} />

        {/* An invalid custom range queries nothing: the header says why. */}
        {!error && (
          <div
            aria-busy={isPending}
            data-pending={isPending ? "" : undefined}
            className="flex min-w-0 flex-col gap-4 transition-opacity data-pending:opacity-60 md:gap-6"
          >
            <SectionBoundary
              loading={<KpiCardsLoading />}
              renderError={(body) => (
                <Card className="min-w-0 px-4">{body}</Card>
              )}
            >
              <KpiCards input={input} />
            </SectionBoundary>

            <Section
              title={C.revenueTitle}
              description={C.revenueByMethod}
              heightClass={CHART_HEIGHT}
            >
              <RevenueChart input={input} />
            </Section>

            <div className={ROW}>
              <Section
                title={C.appointmentsTitle}
                description={C.appointmentsDescription}
                heightClass={CHART_HEIGHT}
                className="xl:col-span-2"
              >
                <AppointmentsChart input={input} />
              </Section>
              <Section
                title={C.methodsTitle}
                description={C.methodsDescription}
                heightClass={DONUT_HEIGHT}
              >
                <PaymentMethodsCard input={input} />
              </Section>
            </div>

            <div className={ROW}>
              <Section
                title={C.topActesTitle}
                description={C.topActesDescription(
                  TOP_ACTES_ORDER_LABELS[TopActesOrder.ByCount],
                )}
                heightClass={BARS_HEIGHT}
                className="xl:col-span-2"
              >
                <TopActesChart input={input} />
              </Section>
              <Section
                title={C.categoriesTitle}
                description={C.categoriesDescription}
                heightClass={DONUT_HEIGHT}
              >
                <CategoriesCard input={input} />
              </Section>
            </div>

            <div className="grid gap-4 *:min-w-0 md:gap-6 xl:grid-cols-2">
              <Section
                title={C.weekdayTitle}
                description={C.weekdayDescription}
                heightClass={CHART_HEIGHT}
              >
                <WeekdayChart input={input} />
              </Section>
              <Section
                title={C.heatmapTitle}
                description={C.heatmapDescription}
                heightClass={CHART_HEIGHT}
              >
                <AttendanceHeatmap input={input} />
              </Section>
            </div>

            <div className={ROW}>
              <Section
                title={C.chargesTitle}
                description={C.chargesDescription}
                heightClass={CHART_HEIGHT}
              >
                <RevenueVsChargesChart input={input} />
              </Section>
              <Section
                title={C.insurersTitle}
                description={C.insurersDescription}
                heightClass={DONUT_HEIGHT}
              >
                <InsurersCard input={input} />
              </Section>
              <Section
                title={C.practitionersTitle}
                description={C.practitionersDescription}
                heightClass={CHART_HEIGHT}
                className="md:col-span-2 xl:col-span-1"
              >
                <PractitionersChart input={input} />
              </Section>
            </div>
          </div>
        )}
      </div>
    </AmountsVisibilityProvider>
  );
};

/** Before the view mounts (the page's own Suspense): header-shaped. */
export const StatisticsViewLoading = () => (
  <div
    role="status"
    aria-label={COPY.loading}
    className="flex flex-col gap-4 md:gap-6"
  >
    <Skeleton className="h-20 rounded-xl" />
    <KpiCardsLoading />
    <Skeleton className="h-[330px] rounded-xl" />
  </div>
);

/**
 * The page's ErrorBoundary — only reached if the view itself fails to mount
 * (each section catches its own errors). «Réessayer» clears failed queries
 * first, or `useSuspenseQuery` would rethrow the cached error.
 */
export const StatisticsViewError = () => {
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

export default StatisticsView;
