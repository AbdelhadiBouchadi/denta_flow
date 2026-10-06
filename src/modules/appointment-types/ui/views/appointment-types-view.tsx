"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { DataTable } from "@/components/shared/data-table";
import EmptyState from "@/components/shared/empty-state";
import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { authClient } from "@/lib/auth-client";
import { StaffRole } from "@/modules/staff/types";
import { useTRPC } from "@/trpc/client";
import { APPOINTMENT_TYPE_COPY } from "../../constants";
import { actionsColumn, columns } from "../columns";
import NewAppointmentTypeButton from "../new-appointment-type-button";

/**
 * The «Types de rendez-vous» section of /parametres. `appointmentTypes.getMany`
 * is prefetched by the page; this reads it from the hydrated cache. No
 * pagination and no filters: a clinic has a handful of types.
 */
const AppointmentTypesView = () => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.appointmentTypes.getMany.queryOptions(),
  );

  // Cosmetic only — every write behind the actions column is adminProcedure.
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === StaffRole.Admin;
  const visibleColumns = useMemo(
    () => (isAdmin ? [...columns, actionsColumn] : columns),
    [isAdmin],
  );

  if (data.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 py-10">
        <EmptyState
          title={APPOINTMENT_TYPE_COPY.emptyTitle}
          description={APPOINTMENT_TYPE_COPY.emptyDescription}
        />
        {isAdmin && <NewAppointmentTypeButton />}
      </div>
    );
  }

  return <DataTable columns={visibleColumns} data={data.items} />;
};

export const AppointmentTypesViewLoading = () => (
  <LoadingState
    title={APPOINTMENT_TYPE_COPY.loadingTitle}
    description={APPOINTMENT_TYPE_COPY.loadingDescription}
  />
);

export const AppointmentTypesViewError = () => (
  <ErrorState
    title={APPOINTMENT_TYPE_COPY.errorTitle}
    description={APPOINTMENT_TYPE_COPY.errorDescription}
  />
);

export default AppointmentTypesView;
