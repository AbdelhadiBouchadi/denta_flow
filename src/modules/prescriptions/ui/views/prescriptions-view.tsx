"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useTransition } from "react";

import DataPagination from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import EmptyState from "@/components/shared/empty-state";
import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { Separator } from "@/components/ui/separator";
import { DEFAULT_PAGE } from "@/constants";
import { authClient } from "@/lib/auth-client";
import { canWriteMedicalDocuments } from "@/modules/documents/rules";
import { useTRPC } from "@/trpc/client";
import { PRESCRIPTION_COPY as COPY } from "../../constants";
import { usePrescriptionsFilters } from "../../hooks/use-prescriptions-filters";
import { medicationsQueryInput } from "../../query-inputs";
import { MedicationStatusFilter } from "../../types";
import { actionsColumn, columns } from "../columns";
import PacksPanel from "../packs-panel";

/**
 * The «Médicaments et packs» section of /parametres: the medication table
 * (a page at a time, filtered from the URL) and the packs below it. Both
 * queries are prefetched by the page with the same inputs.
 */
const PrescriptionsView = () => {
  const trpc = useTRPC();
  const [filters, setFilters] = usePrescriptionsFilters();
  const [, startTransition] = useTransition();
  const { data } = useSuspenseQuery(
    trpc.medications.getMany.queryOptions(medicationsQueryInput(filters)),
  );

  // Cosmetic only — every write is a `medicalWriterProcedure`.
  const { data: session } = authClient.useSession();
  const canWrite = canWriteMedicalDocuments(session?.user.role);
  const visibleColumns = useMemo(
    () => (canWrite ? [...columns, actionsColumn] : columns),
    [canWrite],
  );

  const hasFilters = Boolean(
    filters.medSearch || filters.medStatus !== MedicationStatusFilter.All,
  );
  const isEmpty = data.items.length === 0;

  return (
    <div className="flex min-w-0 flex-col gap-y-6">
      <div className="flex min-w-0 flex-col gap-y-4">
        {isEmpty ? (
          <div className="py-8">
            <EmptyState
              title={hasFilters ? COPY.noResultTitle : COPY.emptyMedicationsTitle}
              description={
                hasFilters
                  ? COPY.noResultDescription
                  : COPY.emptyMedicationsDescription
              }
            />
          </div>
        ) : (
          <DataTable columns={visibleColumns} data={data.items} />
        )}

        {(!isEmpty || filters.medPage > DEFAULT_PAGE) && (
          <DataPagination
            page={filters.medPage}
            totalPages={data.totalPages}
            onPageChange={(medPage) =>
              startTransition(() => {
                void setFilters({ medPage });
              })
            }
          />
        )}
      </div>

      <Separator />

      <PacksPanel canWrite={canWrite} />
    </div>
  );
};

export const PrescriptionsViewLoading = () => (
  <LoadingState title={COPY.loadingTitle} description={COPY.loadingDescription} />
);

export const PrescriptionsViewError = () => (
  <ErrorState title={COPY.errorTitle} description={COPY.errorDescription} />
);

export default PrescriptionsView;
