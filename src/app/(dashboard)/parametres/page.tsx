import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Building2Icon, UsersIcon } from "lucide-react";

import { auth } from "@/lib/auth";
import { CLINIC_SETTINGS_COPY } from "@/modules/clinic/constants";
import SettingsShell from "@/modules/clinic/ui/settings-shell";
import ClinicSettingsView, {
  ClinicSettingsViewError,
  ClinicSettingsViewLoading,
} from "@/modules/clinic/ui/views/clinic-settings-view";
import { STAFF_COPY } from "@/modules/staff/constants";
import StaffListHeader from "@/modules/staff/ui/list-header";
import StaffView, {
  StaffViewError,
  StaffViewLoading,
} from "@/modules/staff/ui/views/staff-view";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: CLINIC_SETTINGS_COPY.pageTitle,
};

/**
 * One route for every settings section; the active one is `?section=` (nuqs).
 * Each later settings branch adds exactly one entry to the list below — its
 * `id`, `label`, `icon` and `content` — plus its prefetch. None adds a route.
 */
const SettingsPage = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(trpc.clinic.get.queryOptions());
  void queryClient.prefetchQuery(trpc.staff.getMany.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SettingsShell
        sections={[
          {
            id: "general",
            label: CLINIC_SETTINGS_COPY.generalSection,
            icon: <Building2Icon />,
            content: (
              <Suspense fallback={<ClinicSettingsViewLoading />}>
                <ErrorBoundary fallback={<ClinicSettingsViewError />}>
                  <ClinicSettingsView />
                </ErrorBoundary>
              </Suspense>
            ),
          },
          {
            id: "users",
            label: STAFF_COPY.sectionTitle,
            icon: <UsersIcon />,
            content: (
              <>
                <StaffListHeader />
                <Suspense fallback={<StaffViewLoading />}>
                  <ErrorBoundary fallback={<StaffViewError />}>
                    <StaffView />
                  </ErrorBoundary>
                </Suspense>
              </>
            ),
          },
        ]}
      />
    </HydrationBoundary>
  );
};

export default SettingsPage;
