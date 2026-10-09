"use client";

import {
  useQueryErrorResetBoundary,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { LockIcon, RotateCcwIcon } from "lucide-react";
import { useTransition } from "react";
import type { FallbackProps } from "react-error-boundary";

import DataPagination from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import EmptyState from "@/components/shared/empty-state";
import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@/constants";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import { isForbiddenError, retryUnlessDenied } from "../../access";
import { EXPENSE_COPY as COPY } from "../../constants";
import { useExpensesFilters } from "../../hooks/use-expenses-filters";
import { columns } from "../columns";
import ExpenseSummary from "../expense-summary";

/** The clinic's `/charges`: the summary strip, then the list a page at a time. */
const ExpensesView = () => {
  const trpc = useTRPC();
  const [filters, setFilters] = useExpensesFilters();
  const [, startTransition] = useTransition();

  // The same input the page prefetched, key for key (04-hydration.md §4).
  // `retry` is an observer option, not part of the key.
  const { data } = useSuspenseQuery({
    ...trpc.expenses.getMany.queryOptions({ ...filters }),
    retry: retryUnlessDenied,
  });

  const hasFilters = Boolean(
    filters.search || filters.category || filters.from || filters.to,
  );
  const isEmpty = data.items.length === 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-y-4 px-4 pb-4 md:px-8">
      <ExpenseSummary />

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

export const ExpensesViewLoading = () => (
  <LoadingState
    title={COPY.loadingTitle}
    description={COPY.loadingDescription}
  />
);

/**
 * The page's ErrorBoundary `FallbackComponent`. Two different answers:
 *
 * - FORBIDDEN — a non-admin typed `/charges`. The explicit French state, its
 *   sentence the PROCEDURE's own message (02-auth.md §5 rule 2): no redirect
 *   pretending the page does not exist, and no «Réessayer», since the answer
 *   will not change.
 * - anything else — the usual error, with «Réessayer»: clear the failed
 *   queries first, or `useSuspenseQuery` would rethrow the cached error.
 */
export const ExpensesViewError = ({ error, resetErrorBoundary }: FallbackProps) => {
  const { reset } = useQueryErrorResetBoundary();

  if (isForbiddenError(error)) {
    return (
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center"
      >
        <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
          <LockIcon className="size-6" aria-hidden="true" />
        </span>
        <div className="flex max-w-md flex-col gap-2">
          <h2 className="text-lg font-medium">{COPY.forbiddenTitle}</h2>
          <p className="text-sm">{getErrorMessage(error)}</p>
          <p className="text-muted-foreground text-sm">{COPY.forbiddenHint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4">
      <ErrorState title={COPY.errorTitle} description={COPY.errorDescription} />
      <Button
        variant="outline"
        onClick={() => {
          reset();
          resetErrorBoundary();
        }}
      >
        <RotateCcwIcon />
        {COPY.retry}
      </Button>
    </div>
  );
};

export default ExpensesView;
