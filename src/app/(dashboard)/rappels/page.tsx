import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SearchParams } from "nuqs/server";

import { auth } from "@/lib/auth";
import { WHATSAPP_COPY } from "@/modules/whatsapp/constants";
import { loadSearchParams } from "@/modules/whatsapp/params";
import { byDayQueryInput } from "@/modules/whatsapp/query-inputs";
import RappelsListHeader from "@/modules/whatsapp/ui/rappels-list-header";
import RappelsView, {
  RappelsViewError,
  RappelsViewLoading,
} from "@/modules/whatsapp/ui/views/rappels-view";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: WHATSAPP_COPY.rappelsTitle,
};

interface Props {
  searchParams: Promise<SearchParams>;
}

/**
 * A routing shell (AGENTS.md §1): session, searchParams, prefetch, the
 * slice's view. Every staff member — the page's actions are all-staff
 * procedures. The input comes from the function the view also calls.
 */
const RappelsPage = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.whatsapp.getByDay.queryOptions(byDayQueryInput(filters)),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RappelsListHeader />
      <Suspense fallback={<RappelsViewLoading />}>
        <ErrorBoundary FallbackComponent={RappelsViewError}>
          <RappelsView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default RappelsPage;
