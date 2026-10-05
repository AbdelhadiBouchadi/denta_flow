import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import DashboardShell from "@/modules/dashboard/ui/dashboard-shell";
import { getQueryClient, trpc } from "@/trpc/server";

interface Props {
  children: React.ReactNode;
}

/**
 * Structural, plus one prefetch: `clinic.get` feeds the sidebar brand on every
 * dashboard route — a single row, so it is cheap. It gates nothing: the
 * session check is tier 2 in 02-auth.md §3 and belongs to each page, where the
 * redirect can be decided alongside what that page prefetches.
 */
const DashboardLayout = ({ children }: Props) => {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(trpc.clinic.get.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardShell>{children}</DashboardShell>
    </HydrationBoundary>
  );
};

export default DashboardLayout;
