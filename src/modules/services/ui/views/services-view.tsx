"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useTransition } from "react";

import DataPagination from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import EmptyState from "@/components/shared/empty-state";
import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { DEFAULT_PAGE } from "@/constants";
import { authClient } from "@/lib/auth-client";
import { StaffRole } from "@/modules/staff/types";
import { useTRPC } from "@/trpc/client";
import { SERVICE_COPY } from "../../constants";
import { useServicesFilters } from "../../hooks/use-services-filters";
import { ServiceStatusFilter } from "../../types";
import CatalogueButtons from "../catalogue-buttons";
import { actionsColumn, columns } from "../columns";

/**
 * The «Actes» section of /parametres. `services.getMany` is prefetched by the
 * page with the same URL filters; this reads it from the hydrated cache.
 */
const ServicesView = () => {
  const trpc = useTRPC();
  const [filters, setFilters] = useServicesFilters();
  const [, startTransition] = useTransition();

  // The same input the page prefetched, key for key (04-hydration.md §4 rule 2).
  const { data } = useSuspenseQuery(
    trpc.services.getMany.queryOptions({ ...filters }),
  );

  // Cosmetic only — every write behind the actions column is adminProcedure.
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === StaffRole.Admin;
  const visibleColumns = useMemo(
    () => (isAdmin ? [...columns, actionsColumn] : columns),
    [isAdmin],
  );

  const hasFilters = Boolean(
    filters.search ||
      filters.category ||
      filters.status !== ServiceStatusFilter.All,
  );
  const isEmpty = data.items.length === 0;

  return (
    <div className="flex flex-col gap-y-4">
      {isEmpty ? (
        // Two different empties: a catalogue with nothing in it yet, and a
        // search that matched nothing in a catalogue that has rows.
        <div className="flex flex-col items-center gap-6 py-10">
          {hasFilters ? (
            <EmptyState
              title={SERVICE_COPY.noResultTitle}
              description={SERVICE_COPY.noResultDescription}
            />
          ) : (
            <>
              <EmptyState
                title={SERVICE_COPY.emptyTitle}
                description={SERVICE_COPY.emptyDescription}
              />
              {isAdmin && <CatalogueButtons />}
            </>
          )}
        </div>
      ) : (
        <DataTable columns={visibleColumns} data={data.items} />
      )}

      {/* Kept on screen when a filtered page 2 comes back empty — otherwise the
          only way back to page 1 would be editing the URL by hand. */}
      {(!isEmpty || filters.page > DEFAULT_PAGE) && (
        <DataPagination
          page={filters.page}
          totalPages={data.totalPages}
          onPageChange={(page) =>
            startTransition(() => {
              void setFilters({ page });
            })
          }
        />
      )}
    </div>
  );
};

export const ServicesViewLoading = () => (
  <LoadingState
    title={SERVICE_COPY.loadingTitle}
    description={SERVICE_COPY.loadingDescription}
  />
);

export const ServicesViewError = () => (
  <ErrorState
    title={SERVICE_COPY.errorTitle}
    description={SERVICE_COPY.errorDescription}
  />
);

export default ServicesView;
