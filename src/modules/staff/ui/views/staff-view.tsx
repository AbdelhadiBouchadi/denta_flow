"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { DataTable } from "@/components/shared/data-table";
import EmptyState from "@/components/shared/empty-state";
import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import { STAFF_COPY } from "../../constants";
import { StaffRole } from "../../types";
import { actionsColumn, columns } from "../columns";

/**
 * The «Utilisateurs» section of /parametres. `staff.getMany` is prefetched by
 * the page; this reads it from the hydrated cache. No pagination and no
 * filters: a clinic has a handful of staff (prompts/12-utilisateurs.md).
 */
const StaffView = () => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.staff.getMany.queryOptions());

  // Cosmetic only — every write behind the actions column is adminProcedure.
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === StaffRole.Admin;
  // A stable array: a fresh one each render would rebuild the table's columns.
  const visibleColumns = useMemo(
    () => (isAdmin ? [...columns, actionsColumn] : columns),
    [isAdmin],
  );

  if (data.items.length === 0) {
    return (
      <div className="py-10">
        <EmptyState
          title={STAFF_COPY.emptyTitle}
          description={STAFF_COPY.emptyDescription}
        />
      </div>
    );
  }

  return <DataTable columns={visibleColumns} data={data.items} />;
};

export const StaffViewLoading = () => (
  <LoadingState
    title={STAFF_COPY.loadingTitle}
    description={STAFF_COPY.loadingDescription}
  />
);

export const StaffViewError = () => (
  <ErrorState
    title={STAFF_COPY.errorTitle}
    description={STAFF_COPY.errorDescription}
  />
);

export default StaffView;
