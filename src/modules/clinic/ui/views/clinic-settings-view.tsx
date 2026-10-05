"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { useTRPC } from "@/trpc/client";
import { CLINIC_SETTINGS_COPY } from "../../constants";
import { ClinicSettingsForm } from "../clinic-settings-form";

/**
 * The «Général» section of /parametres. `clinic.get` is prefetched by the
 * page; this reads it from the hydrated cache and never fetches on mount.
 */
const ClinicSettingsView = () => {
  const trpc = useTRPC();
  const { data: clinic } = useSuspenseQuery(trpc.clinic.get.queryOptions());

  return <ClinicSettingsForm clinic={clinic} />;
};

export const ClinicSettingsViewLoading = () => (
  <LoadingState
    title={CLINIC_SETTINGS_COPY.loadingTitle}
    description={CLINIC_SETTINGS_COPY.loadingDescription}
  />
);

export const ClinicSettingsViewError = () => (
  <ErrorState
    title={CLINIC_SETTINGS_COPY.errorTitle}
    description={CLINIC_SETTINGS_COPY.errorDescription}
  />
);

export default ClinicSettingsView;
