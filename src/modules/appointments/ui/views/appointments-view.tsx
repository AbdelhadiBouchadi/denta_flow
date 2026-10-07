"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useEffect, useTransition } from "react";

import DataPagination from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import EmptyState from "@/components/shared/empty-state";
import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@/constants";
import { toClinicDate } from "@/lib/time";
import { useTRPC } from "@/trpc/client";
import { APPOINTMENT_COPY, dayAppointmentCount } from "../../constants";
import { useAppointmentsFilters } from "../../hooks/use-appointments-filters";
import { clampPage } from "../../pagination";
import type { AppointmentListItem } from "../../types";
import { columns } from "../columns";

/** «Lundi 5 octobre», from a clinic calendar day. */
const formatDayHeader = (day: string) => {
  const label = format(parseISO(day), "EEEE d MMMM", { locale: fr });
  return label.charAt(0).toLocaleUpperCase("fr-FR") + label.slice(1);
};

/**
 * The paginated list of `/rendez-vous`, rows grouped under day headers. The
 * agenda grid of `/calendrier` (branch 18) reads the unpaginated `getMany`.
 */
const AppointmentsView = () => {
  const trpc = useTRPC();
  const [filters, setFilters] = useAppointmentsFilters();
  const [, startTransition] = useTransition();

  // The same input the page prefetched, key for key — the raw URL values;
  // the range is derived inside the procedure (04-hydration.md §4 rules 2, 11).
  const { data } = useSuspenseQuery(
    trpc.appointments.getPage.queryOptions({ ...filters }),
  );

  // A page past the end — its last row was just deleted, or the link is
  // stale — moves to the last real page instead of showing an empty table.
  const clampedPage = clampPage(filters.page, data.totalPages);
  useEffect(() => {
    if (clampedPage !== filters.page) {
      startTransition(() => {
        void setFilters({ page: clampedPage });
      });
    }
  }, [clampedPage, filters.page, setFilters]);

  const dayCounts = new Map(data.dayCounts.map(({ day, count }) => [day, count]));
  // Grouped on the clinic's wall clock, the same day the procedure counted.
  const dayGroup = (appointment: AppointmentListItem) => {
    const day = toClinicDate(appointment.startsAt);
    return {
      key: day,
      header: (
        <span suppressHydrationWarning>
          {formatDayHeader(day)}
          <span className="text-muted-foreground font-normal">
            {" · "}
            {dayAppointmentCount(dayCounts.get(day) ?? 0)}
          </span>
        </span>
      ),
    };
  };

  const hasFilters = Boolean(
    filters.practitionerId || filters.status || filters.patientId,
  );
  const isEmpty = data.items.length === 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-y-4 px-4 pb-4 md:px-8">
      {isEmpty ? (
        // Replaces the table rather than sitting under it: the DataTable's
        // own «Aucun résultat.» row would say the same thing twice.
        <div className="flex flex-1 flex-col justify-center py-10">
          <EmptyState
            title={APPOINTMENT_COPY.emptyTitle}
            description={
              hasFilters
                ? APPOINTMENT_COPY.emptyFiltered
                : APPOINTMENT_COPY.emptyDefault
            }
          />
        </div>
      ) : (
        <DataTable columns={columns} data={data.items} getRowGroup={dayGroup} />
      )}

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

export const AppointmentsViewLoading = () => (
  <LoadingState
    title={APPOINTMENT_COPY.loadingTitle}
    description={APPOINTMENT_COPY.loadingDescription}
  />
);

export const AppointmentsViewError = () => (
  <ErrorState
    title={APPOINTMENT_COPY.errorTitle}
    description={APPOINTMENT_COPY.errorDescription}
  />
);

export default AppointmentsView;
