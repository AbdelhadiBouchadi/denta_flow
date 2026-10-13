import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SearchParams } from "nuqs/server";

import { auth } from "@/lib/auth";
import { ADMIN_ROLE } from "@/modules/dashboard/constants";
import { loadSearchParams } from "@/modules/statistics/params";
import { toPeriodInput } from "@/modules/statistics/period";
import { statisticsInputSchema } from "@/modules/statistics/schemas";
import StatisticsView, {
  StatisticsViewError,
  StatisticsViewLoading,
} from "@/modules/statistics/ui/views/statistics-view";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Statistiques",
};

interface Props {
  searchParams: Promise<SearchParams>;
}

/**
 * A routing shell: read the session, await searchParams, prefetch, render
 * the slice's view (AGENTS.md §1).
 *
 * Admin only (prompts/30, decision 1): a non-admin is redirected to the
 * dashboard here — this page is all revenue, production and charges — and
 * every procedure is an `adminProcedure` regardless. The redirect is the
 * page's, never `proxy.ts`'s (02-auth.md §5 rule 2).
 *
 * Every section the view renders is prefetched with `void`, with the input
 * built by the SAME `toPeriodInput` the view uses — one key per query, so
 * the first paint makes no `/api/trpc` call. Each section has its own
 * Suspense + ErrorBoundary inside the view; the ones here only cover the
 * view's own mount. An invalid custom range prefetches nothing: the view
 * shows the schema's French message instead of querying.
 */
const StatistiquesPage = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");
  if (session.user.role !== ADMIN_ROLE) redirect("/tableau-de-bord");

  const queryClient = getQueryClient();
  const input = toPeriodInput(filters);
  if (statisticsInputSchema.safeParse(input).success) {
    // `void`, never `await` (04-hydration.md §4 rule 1).
    void queryClient.prefetchQuery(
      trpc.statistics.getOverview.queryOptions(input),
    );
    void queryClient.prefetchQuery(
      trpc.statistics.getRevenueSeries.queryOptions(input),
    );
    void queryClient.prefetchQuery(
      trpc.statistics.getAppointmentsSeries.queryOptions(input),
    );
    void queryClient.prefetchQuery(
      trpc.statistics.getPaymentMethodBreakdown.queryOptions(input),
    );
    void queryClient.prefetchQuery(
      trpc.statistics.getTopActes.queryOptions(input),
    );
    void queryClient.prefetchQuery(
      trpc.statistics.getActesByCategory.queryOptions(input),
    );
    void queryClient.prefetchQuery(
      trpc.statistics.getAppointmentsDistribution.queryOptions(input),
    );
    void queryClient.prefetchQuery(
      trpc.statistics.getRevenueVsCharges.queryOptions(input),
    );
    void queryClient.prefetchQuery(
      trpc.statistics.getInsurerBreakdown.queryOptions(input),
    );
    void queryClient.prefetchQuery(
      trpc.statistics.getByPractitioner.queryOptions(input),
    );
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<StatisticsViewLoading />}>
        <ErrorBoundary FallbackComponent={StatisticsViewError}>
          <StatisticsView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default StatistiquesPage;
