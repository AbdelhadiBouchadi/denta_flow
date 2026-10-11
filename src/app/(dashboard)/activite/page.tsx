import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SearchParams } from "nuqs/server";

import { auth } from "@/lib/auth";
import { loadSearchParams } from "@/modules/activity/params";
import {
  activityQueryInputs,
  getNextActivityCursor,
} from "@/modules/activity/query-inputs";
import ActivityListHeader from "@/modules/activity/ui/list-header";
import ActivityView, {
  ActivityViewError,
  ActivityViewLoading,
} from "@/modules/activity/ui/views/activity-view";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Activité du jour",
};

interface Props {
  searchParams: Promise<SearchParams>;
}

/**
 * A routing shell: read the session, await searchParams, prefetch, render the
 * slice's view (AGENTS.md §1). The inputs come from the same function the
 * view calls, so the three keys match byte for byte.
 */
const ActivityPage = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const inputs = activityQueryInputs(filters);
  const queryClient = getQueryClient();
  // `void`, never `await` (04-hydration.md §4 rule 1).
  void queryClient.prefetchInfiniteQuery(
    trpc.activity.getDay.infiniteQueryOptions(inputs.day, {
      getNextPageParam: getNextActivityCursor,
    }),
  );
  void queryClient.prefetchQuery(
    trpc.activity.getDayCounts.queryOptions(inputs.counts),
  );
  void queryClient.prefetchQuery(trpc.activity.getStaff.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ActivityListHeader />
      <Suspense fallback={<ActivityViewLoading />}>
        <ErrorBoundary FallbackComponent={ActivityViewError}>
          <ActivityView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default ActivityPage;
