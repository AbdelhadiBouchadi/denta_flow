import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SearchParams } from "nuqs/server";

import { auth } from "@/lib/auth";
import { loadSearchParams } from "@/modules/documents/params";
import DocumentsListHeader from "@/modules/documents/ui/list-header";
import DocumentsView, {
  DocumentsViewError,
  DocumentsViewLoading,
} from "@/modules/documents/ui/views/documents-view";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Documents",
};

interface Props {
  searchParams: Promise<SearchParams>;
}

/**
 * A routing shell: read the session, await searchParams, prefetch, render the
 * slice's view. No business logic, no data mapping (AGENTS.md §1).
 */
const DocumentsPage = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const queryClient = getQueryClient();
  // `void`, never `await` (04-hydration.md §4 rule 1).
  void queryClient.prefetchQuery(
    trpc.documents.getMany.queryOptions({ ...filters }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DocumentsListHeader />
      <Suspense fallback={<DocumentsViewLoading />}>
        <ErrorBoundary fallback={<DocumentsViewError />}>
          <DocumentsView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default DocumentsPage;
