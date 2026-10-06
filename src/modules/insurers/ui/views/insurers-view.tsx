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
import { INSURER_COPY } from "../../constants";
import { actionsColumn, columns } from "../columns";
import NewInsurerButton from "../new-insurer-button";

/**
 * The «Assurances» section of /parametres. `insurers.getMany` is prefetched
 * by the page; this reads it from the hydrated cache. Every insurer is listed,
 * inactive ones muted at the bottom.
 */
const InsurersView = () => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.insurers.getMany.queryOptions());

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
          title={INSURER_COPY.emptyTitle}
          description={INSURER_COPY.emptyDescription}
        />
        {isAdmin && <NewInsurerButton />}
      </div>
    );
  }

  return <DataTable columns={visibleColumns} data={data.items} />;
};

export const InsurersViewLoading = () => (
  <LoadingState
    title={INSURER_COPY.loadingTitle}
    description={INSURER_COPY.loadingDescription}
  />
);

export const InsurersViewError = () => (
  <ErrorState
    title={INSURER_COPY.errorTitle}
    description={INSURER_COPY.errorDescription}
  />
);

export default InsurersView;
