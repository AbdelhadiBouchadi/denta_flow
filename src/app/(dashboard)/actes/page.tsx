import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SearchParams } from "nuqs/server";

import { auth } from "@/lib/auth";
import { loadSearchParams } from "@/modules/treatments/params";
import TreatmentsListHeader from "@/modules/treatments/ui/list-header";
import TreatmentsView, {
  TreatmentsViewError,
  TreatmentsViewLoading,
} from "@/modules/treatments/ui/views/treatments-view";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Actes",
};

interface Props {
  searchParams: Promise<SearchParams>;
}

/**
 * A routing shell: read the session, await searchParams, prefetch, render the
 * slice's view. No business logic, no data mapping (AGENTS.md §1).
 */
const TreatmentsPage = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const queryClient = getQueryClient();
  // `void`, never `await` (04-hydration.md §4 rule 1).
  void queryClient.prefetchQuery(
    trpc.treatments.getMany.queryOptions({ ...filters }),
  );
  // The header's practitioner filter and the new-acte dialog.
  void queryClient.prefetchQuery(
    trpc.schedules.getPractitioners.queryOptions(),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TreatmentsListHeader />
      <Suspense fallback={<TreatmentsViewLoading />}>
        <ErrorBoundary fallback={<TreatmentsViewError />}>
          <TreatmentsView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default TreatmentsPage;
