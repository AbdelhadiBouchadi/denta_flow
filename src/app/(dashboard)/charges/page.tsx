import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SearchParams } from "nuqs/server";

import { auth } from "@/lib/auth";
import { ADMIN_ROLE } from "@/modules/dashboard/constants";
import { loadSearchParams } from "@/modules/expenses/params";
import ExpensesListHeader from "@/modules/expenses/ui/list-header";
import ExpensesView, {
  ExpensesViewError,
  ExpensesViewLoading,
} from "@/modules/expenses/ui/views/expenses-view";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Charges",
};

interface Props {
  searchParams: Promise<SearchParams>;
}

/**
 * A routing shell: read the session, await searchParams, prefetch, render the
 * slice's view (AGENTS.md §1).
 *
 * Admin-only end to end, and the refusal is the PROCEDURE's: a non-admin is
 * not redirected (02-auth.md §5 rule 2). The prefetch is for the admin only —
 * a pending query that rejects is dehydrated with its error redacted, which
 * would erase the FORBIDDEN code. A non-admin's view asks for itself and
 * meets the procedure's FORBIDDEN, which `ExpensesViewError` renders as the
 * forbidden state.
 */
const ChargesPage = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const queryClient = getQueryClient();
  if (session.user.role === ADMIN_ROLE) {
    // `void`, never `await` (04-hydration.md §4 rule 1).
    void queryClient.prefetchQuery(
      trpc.expenses.getMany.queryOptions({ ...filters }),
    );
    // The summary strip: the list's filters minus `page`.
    void queryClient.prefetchQuery(
      trpc.expenses.getSummary.queryOptions({
        search: filters.search,
        category: filters.category,
        from: filters.from,
        to: filters.to,
      }),
    );
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ExpensesListHeader />
      <Suspense fallback={<ExpensesViewLoading />}>
        <ErrorBoundary FallbackComponent={ExpensesViewError}>
          <ExpensesView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default ChargesPage;
