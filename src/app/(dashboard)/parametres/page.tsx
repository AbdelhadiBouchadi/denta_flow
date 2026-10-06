import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SearchParams } from "nuqs/server";
import {
  Building2Icon,
  ClipboardListIcon,
  ShieldCheckIcon,
  TagsIcon,
  UsersIcon,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { CLINIC_SETTINGS_COPY } from "@/modules/clinic/constants";
import SettingsShell from "@/modules/clinic/ui/settings-shell";
import ClinicSettingsView, {
  ClinicSettingsViewError,
  ClinicSettingsViewLoading,
} from "@/modules/clinic/ui/views/clinic-settings-view";
import { INSURER_COPY } from "@/modules/insurers/constants";
import InsurersListHeader from "@/modules/insurers/ui/list-header";
import InsurersView, {
  InsurersViewError,
  InsurersViewLoading,
} from "@/modules/insurers/ui/views/insurers-view";
import { SERVICE_COPY } from "@/modules/services/constants";
import { loadSearchParams as loadServicesSearchParams } from "@/modules/services/params";
import ServicesListHeader from "@/modules/services/ui/list-header";
import ServicesView, {
  ServicesViewError,
  ServicesViewLoading,
} from "@/modules/services/ui/views/services-view";
import { STAFF_COPY } from "@/modules/staff/constants";
import StaffListHeader from "@/modules/staff/ui/list-header";
import StaffView, {
  StaffViewError,
  StaffViewLoading,
} from "@/modules/staff/ui/views/staff-view";
import { TAG_COPY } from "@/modules/tags/constants";
import TagsListHeader from "@/modules/tags/ui/list-header";
import TagsView, {
  TagsViewError,
  TagsViewLoading,
} from "@/modules/tags/ui/views/tags-view";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: CLINIC_SETTINGS_COPY.pageTitle,
};

/**
 * One route for every settings section; the active one is `?section=` (nuqs).
 * Each later settings branch adds exactly one entry to the list below — its
 * `id`, `label`, `icon` and `content` — plus its prefetch. None adds a route.
 */
interface Props {
  searchParams: Promise<SearchParams>;
}

const SettingsPage = async ({ searchParams }: Props) => {
  // «Actes» is the one section with list filters in the URL.
  const servicesFilters = await loadServicesSearchParams(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(trpc.clinic.get.queryOptions());
  void queryClient.prefetchQuery(trpc.staff.getMany.queryOptions());
  void queryClient.prefetchQuery(trpc.tags.getMany.queryOptions());
  void queryClient.prefetchQuery(trpc.insurers.getMany.queryOptions());
  void queryClient.prefetchQuery(
    trpc.services.getMany.queryOptions({ ...servicesFilters }),
  );

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
          {
            id: "tags",
            label: TAG_COPY.sectionTitle,
            icon: <TagsIcon />,
            content: (
              <>
                <TagsListHeader />
                <Suspense fallback={<TagsViewLoading />}>
                  <ErrorBoundary fallback={<TagsViewError />}>
                    <TagsView />
                  </ErrorBoundary>
                </Suspense>
              </>
            ),
          },
          {
            id: "insurers",
            label: INSURER_COPY.sectionTitle,
            icon: <ShieldCheckIcon />,
            content: (
              <>
                <InsurersListHeader />
                <Suspense fallback={<InsurersViewLoading />}>
                  <ErrorBoundary fallback={<InsurersViewError />}>
                    <InsurersView />
                  </ErrorBoundary>
                </Suspense>
              </>
            ),
          },
          {
            id: "services",
            label: SERVICE_COPY.sectionTitle,
            icon: <ClipboardListIcon />,
            content: (
              <>
                <ServicesListHeader />
                <Suspense fallback={<ServicesViewLoading />}>
                  <ErrorBoundary fallback={<ServicesViewError />}>
                    <ServicesView />
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
