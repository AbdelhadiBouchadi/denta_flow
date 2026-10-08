import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SearchParams } from "nuqs/server";

import { auth } from "@/lib/auth";
import { ADMIN_ROLE } from "@/modules/dashboard/constants";
import { loadSearchParams } from "@/modules/dashboard/params";
import DashboardView, {
  DashboardViewError,
  DashboardViewLoading,
} from "@/modules/dashboard/ui/views/dashboard-view";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Tableau de bord",
};

interface Props {
  searchParams: Promise<SearchParams>;
}

/**
 * A routing shell: read the session, await searchParams, prefetch every
 * query the view renders, render the slice's view (AGENTS.md §1).
 *
 * The role is read HERE and passed down as `isAdmin`: the client never
 * guesses it. `getAdminStats` is prefetched for the admin only — prefetching
 * an admin procedure for a secretary would dehydrate a FORBIDDEN — and with
 * the exact input the client reads from the same URL key.
 */
const TableauDeBordPage = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");
  const isAdmin = session.user.role === ADMIN_ROLE;

  const queryClient = getQueryClient();
  // `void`, never `await` (04-hydration.md §4 rule 1).
  void queryClient.prefetchQuery(trpc.dashboard.getStats.queryOptions());
  if (isAdmin) {
    void queryClient.prefetchQuery(
      trpc.dashboard.getAdminStats.queryOptions({ period: filters.period }),
    );
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<DashboardViewLoading isAdmin={isAdmin} />}>
        <ErrorBoundary fallback={<DashboardViewError />}>
          <DashboardView isAdmin={isAdmin} />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default TableauDeBordPage;
