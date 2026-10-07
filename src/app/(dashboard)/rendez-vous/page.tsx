import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SearchParams } from "nuqs/server";

import { auth } from "@/lib/auth";
import { loadSearchParams } from "@/modules/appointments/params";
import AppointmentsListHeader from "@/modules/appointments/ui/list-header";
import AppointmentsView, {
  AppointmentsViewError,
  AppointmentsViewLoading,
} from "@/modules/appointments/ui/views/appointments-view";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Rendez-vous",
};

interface Props {
  searchParams: Promise<SearchParams>;
}

/**
 * A routing shell: read the session, await searchParams, prefetch, render the
 * slice's view. No business logic, no data mapping (AGENTS.md §1).
 */
const AppointmentsPage = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const queryClient = getQueryClient();
  // `void`, never `await` (04-hydration.md §4 rule 1). The raw URL values are
  // the key; the procedure derives the date range from them.
  void queryClient.prefetchQuery(
    trpc.appointments.getPage.queryOptions({ ...filters }),
  );
  // The header's practitioner filter and the new-appointment dialog.
  void queryClient.prefetchQuery(
    trpc.schedules.getPractitioners.queryOptions(),
  );
  void queryClient.prefetchQuery(trpc.appointmentTypes.getMany.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AppointmentsListHeader />
      <Suspense fallback={<AppointmentsViewLoading />}>
        <ErrorBoundary fallback={<AppointmentsViewError />}>
          <AppointmentsView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default AppointmentsPage;
