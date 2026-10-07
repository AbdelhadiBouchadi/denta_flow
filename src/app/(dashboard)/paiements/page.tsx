import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SearchParams } from "nuqs/server";

import { auth } from "@/lib/auth";
import { ADMIN_ROLE } from "@/modules/dashboard/constants";
import { loadSearchParams } from "@/modules/payments/params";
import PaymentsListHeader from "@/modules/payments/ui/list-header";
import PaymentsView, {
  PaymentsViewError,
  PaymentsViewLoading,
} from "@/modules/payments/ui/views/payments-view";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Paiements",
};

interface Props {
  searchParams: Promise<SearchParams>;
}

/**
 * A routing shell: read the session, await searchParams, prefetch, render the
 * slice's view. No business logic, no data mapping (AGENTS.md §1).
 */
const PaymentsPage = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const queryClient = getQueryClient();
  // `void`, never `await` (04-hydration.md §4 rule 1).
  void queryClient.prefetchQuery(
    trpc.payments.getMany.queryOptions({ ...filters }),
  );
  // The header's insurer filter and the «Encaisser» dialog.
  void queryClient.prefetchQuery(trpc.insurers.getMany.queryOptions());
  // The admin totals — prefetched only for the admin, the one role the
  // procedure serves.
  if (session.user.role === ADMIN_ROLE) {
    void queryClient.prefetchQuery(
      trpc.payments.getSummary.queryOptions({
        from: filters.from,
        to: filters.to,
      }),
    );
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PaymentsListHeader />
      <Suspense fallback={<PaymentsViewLoading />}>
        <ErrorBoundary fallback={<PaymentsViewError />}>
          <PaymentsView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default PaymentsPage;
