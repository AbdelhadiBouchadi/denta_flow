import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SearchParams } from "nuqs/server";

import { auth } from "@/lib/auth";
import { loadSearchParams } from "@/modules/patients/params";
import PatientsListHeader from "@/modules/patients/ui/list-header";
import PatientsView, {
  PatientsViewError,
  PatientsViewLoading,
} from "@/modules/patients/ui/views/patients-view";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Patients",
};

interface Props {
  searchParams: Promise<SearchParams>;
}

/**
 * A routing shell: read the session, await searchParams, prefetch, render the
 * slice's view. No business logic, no data mapping (AGENTS.md §1).
 */
const PatientsPage = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const queryClient = getQueryClient();
  // `void`, never `await`: the pending query is dehydrated and streams, instead
  // of the page blocking on the slowest of the three (04-hydration.md §4).
  void queryClient.prefetchQuery(
    trpc.patients.getMany.queryOptions({ ...filters }),
  );
  // Both feed the header's filter selects and the new-patient dialog.
  void queryClient.prefetchQuery(trpc.tags.getMany.queryOptions());
  void queryClient.prefetchQuery(trpc.insurers.getMany.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PatientsListHeader />
      <Suspense fallback={<PatientsViewLoading />}>
        <ErrorBoundary fallback={<PatientsViewError />}>
          <PatientsView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default PatientsPage;
