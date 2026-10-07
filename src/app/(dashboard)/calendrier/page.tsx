import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SearchParams } from "nuqs/server";

import { auth } from "@/lib/auth";
import { loadSearchParams } from "@/modules/appointments/params";
import {
  calendarQueryInput,
  defaultCalendarPractitioner,
} from "@/modules/appointments/ui/calendar-query";
import AppointmentsCalendarView, {
  AppointmentsCalendarError,
  AppointmentsCalendarLoading,
} from "@/modules/appointments/ui/views/calendar-view";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Calendrier",
};

interface Props {
  searchParams: Promise<SearchParams>;
}

/**
 * A routing shell: read the session, await searchParams, prefetch, render the
 * slice's view (AGENTS.md §1). The session read also keeps the route dynamic:
 * a static `(dashboard)` page is prerendered through the layout's
 * `clinic.get` prefetch and fails `next build` (07-calendar.md §2 patch 14).
 */
const CalendarPage = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const defaultPractitionerId = defaultCalendarPractitioner(session.user);

  const queryClient = getQueryClient();
  // `void`, never `await` (04-hydration.md §4 rule 1). The view builds its
  // query input with the same `calendarQueryInput`, so the keys match.
  void queryClient.prefetchQuery(
    trpc.appointments.getMany.queryOptions(
      calendarQueryInput(filters, defaultPractitionerId),
    ),
  );
  // The toolbar's filter and legend, and the appointment form.
  void queryClient.prefetchQuery(
    trpc.schedules.getPractitioners.queryOptions(),
  );
  void queryClient.prefetchQuery(trpc.appointmentTypes.getMany.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<AppointmentsCalendarLoading />}>
        <ErrorBoundary fallback={<AppointmentsCalendarError />}>
          <AppointmentsCalendarView
            defaultPractitionerId={defaultPractitionerId}
          />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default CalendarPage;
