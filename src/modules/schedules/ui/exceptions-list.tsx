"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { DataTable } from "@/components/shared/data-table";
import EmptyState from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { EXCEPTION_COPY } from "../constants";
import { useSchedulesFilters } from "../hooks/use-schedules-filters";
import { actionsColumn, columns } from "./columns";
import NewExceptionDialog from "./new-exception-dialog";

interface ExceptionsListProps {
  isAdmin: boolean;
}

/**
 * «Congés et fermetures». Upcoming by default; «Afficher les passées» is
 * `?includePast=true` (nuqs), the same input the page prefetched.
 */
export const ExceptionsList = ({ isAdmin }: ExceptionsListProps) => {
  const trpc = useTRPC();
  const [filters, setFilters] = useSchedulesFilters();
  const [isSwitching, startTransition] = useTransition();
  const [isNewOpen, setIsNewOpen] = useState(false);

  const { data } = useSuspenseQuery(
    trpc.schedules.getExceptions.queryOptions({
      includePast: filters.includePast,
    }),
  );

  const visibleColumns = useMemo(
    () => (isAdmin ? [...columns, actionsColumn] : columns),
    [isAdmin],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-heading text-foreground text-lg font-semibold">
            {EXCEPTION_COPY.title}
          </h3>
          <p className="text-muted-foreground text-sm">
            {EXCEPTION_COPY.description}
          </p>
        </div>

        {isAdmin && (
          <>
            <Button size="lg" onClick={() => setIsNewOpen(true)}>
              <PlusIcon />
              {EXCEPTION_COPY.add}
            </Button>
            <NewExceptionDialog open={isNewOpen} onOpenChange={setIsNewOpen} />
          </>
        )}
      </div>

      <label className="text-foreground flex w-fit items-center gap-2 text-sm">
        <Switch
          checked={filters.includePast}
          onCheckedChange={(includePast) =>
            startTransition(() => {
              void setFilters({ includePast });
            })
          }
        />
        {EXCEPTION_COPY.showPast}
      </label>

      <div
        className={cn(
          "transition-opacity",
          isSwitching && "pointer-events-none opacity-60",
        )}
      >
        {data.items.length === 0 ? (
          <div className="py-6">
            <EmptyState
              title={
                filters.includePast
                  ? EXCEPTION_COPY.emptyPastTitle
                  : EXCEPTION_COPY.emptyTitle
              }
              description={EXCEPTION_COPY.emptyDescription}
            />
          </div>
        ) : (
          <DataTable columns={visibleColumns} data={data.items} />
        )}
      </div>
    </section>
  );
};
