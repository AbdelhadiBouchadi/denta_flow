"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import DataPagination from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import EmptyState from "@/components/shared/empty-state";
import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { DEFAULT_PAGE } from "@/constants";
import { useTRPC } from "@/trpc/client";
import { usePatientsFilters } from "../../hooks/use-patients-filters";
import { columns } from "../columns";

const PatientsView = () => {
  const trpc = useTRPC();
  const router = useRouter();
  const [filters, setFilters] = usePatientsFilters();
  const [, startTransition] = useTransition();

  // The same input the page prefetched, key for key — that is what makes this
  // resolve from the dehydrated cache instead of firing a request on first
  // paint (04-hydration.md §4 rule 2).
  const { data } = useSuspenseQuery(
    trpc.patients.getMany.queryOptions({ ...filters }),
  );

  const hasFilters = Boolean(
    filters.search || filters.tagId || filters.insurerId,
  );

  const isEmpty = data.items.length === 0;

  return (
    <div className="flex flex-1 flex-col gap-y-4 px-4 pb-4 md:px-8">
      {isEmpty ? (
        // The empty state replaces the table rather than sitting under it: the
        // DataTable's own «Aucun résultat.» row would say the same thing twice.
        <div className="flex flex-1 flex-col justify-center py-10">
          <EmptyState
            title="Aucun patient"
            description={
              hasFilters
                ? "Aucun patient ne correspond à ces critères. Modifiez la recherche ou effacez les filtres."
                : "Créez votre premier dossier patient pour commencer."
            }
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data.items}
          onRowClick={(patient) => router.push(`/patients/${patient.id}`)}
        />
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

export const PatientsViewLoading = () => (
  <LoadingState
    title="Chargement des patients"
    description="Merci de patienter quelques instants…"
  />
);

export const PatientsViewError = () => (
  <ErrorState
    title="Erreur de chargement"
    description="La liste des patients n’a pas pu être chargée. Veuillez réessayer."
  />
);

export default PatientsView;
