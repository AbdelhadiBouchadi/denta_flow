import { headers } from "next/headers";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { auth } from "@/lib/auth";
import DashboardShell from "@/modules/dashboard/ui/dashboard-shell";
import { getQueryClient, trpc } from "@/trpc/server";

interface Props {
  children: React.ReactNode;
}

/**
 * Structural, plus two prefetches for what the shell itself renders on every
 * dashboard route:
 *
 * - `clinic.get` — the sidebar brand, a single row.
 * - `appointments.getWaitingRoom` — the navbar «Salle d’attente» count. The
 *   one domain read a layout makes (04-hydration.md §5): the badge is data,
 *   and without this its first paint would fire its own request. The navbar
 *   reads it with `useQuery` and the exact same options.
 *
 * The session is read ONLY to decide whether to prefetch the waiting room —
 * a protected procedure prefetched without one would stream an
 * UNAUTHORIZED. It gates nothing: the redirect is tier 2 in 02-auth.md §3
 * and belongs to each page.
 */
const DashboardLayout = async ({ children }: Props) => {
  const session = await auth.api.getSession({ headers: await headers() });

  const queryClient = getQueryClient();
  // `void`, never `await` (04-hydration.md §4 rule 1).
  void queryClient.prefetchQuery(trpc.clinic.get.queryOptions());
  if (session) {
    void queryClient.prefetchQuery(
      trpc.appointments.getWaitingRoom.queryOptions(),
    );
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardShell>{children}</DashboardShell>
    </HydrationBoundary>
  );
};

export default DashboardLayout;
