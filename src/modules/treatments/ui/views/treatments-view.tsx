"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTransition } from "react";

import DataPagination from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import EmptyState from "@/components/shared/empty-state";
import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@/constants";
import { useTRPC } from "@/trpc/client";
import { TREATMENT_COPY as COPY } from "../../constants";
import { useTreatmentsFilters } from "../../hooks/use-treatments-filters";
import { columns } from "../columns";

/** The clinic-wide `/actes` list, a page at a time. */
const TreatmentsView = () => {
  const trpc = useTRPC();
  const [filters, setFilters] = useTreatmentsFilters();
  const [, startTransition] = useTransition();

  // The same input the page prefetched, key for key (04-hydration.md §4).
  const { data } = useSuspenseQuery(
    trpc.treatments.getMany.queryOptions({ ...filters }),
  );

  const hasFilters = Boolean(
    filters.search ||
      filters.status ||
      filters.practitionerId ||
      filters.from ||
      filters.to,
  );
  const isEmpty = data.items.length === 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-y-4 px-4 pb-4 md:px-8">
      {isEmpty ? (
        // Replaces the table: the DataTable's own «Aucun résultat.» row would
        // say the same thing twice.
        <div className="flex flex-1 flex-col justify-center py-10">
          <EmptyState
            title={COPY.emptyTitle}
            description={hasFilters ? COPY.emptyFiltered : COPY.emptyDefault}
          />
        </div>
      ) : (
        <DataTable columns={columns} data={data.items} />
      )}

      {/* Kept when a filtered page 2 comes back empty, so page 1 is one
          click away. */}
      {(!isEmpty || filters.page > DEFAULT_PAGE) && (
        <DataPagination
          page={filters.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={DEFAULT_PAGE_SIZE}
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

export const TreatmentsViewLoading = () => (
  <LoadingState
    title={COPY.loadingTitle}
    description={COPY.loadingDescription}
  />
);

export const TreatmentsViewError = () => (
  <ErrorState title={COPY.errorTitle} description={COPY.errorDescription} />
);

export default TreatmentsView;
