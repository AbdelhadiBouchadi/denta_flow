"use client";

import {
  useQueryErrorResetBoundary,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { RotateCcwIcon } from "lucide-react";
import { useTransition } from "react";
import type { FallbackProps } from "react-error-boundary";

import EmptyState from "@/components/shared/empty-state";
import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { ACTIVITY_COPY as COPY } from "../../constants";
import { useActivityFilters } from "../../hooks/use-activity-filters";
import { activityQueryInputs, getNextActivityCursor } from "../../query-inputs";
import ActivityTimeline from "../activity-timeline";
import ActivityToolbar from "../activity-toolbar";
import WeekStrip from "../week-strip";

/**
 * `/activite`: the week strip, the filters, then the day's timeline. Three
 * reads, all prefetched by the page under the same keys — the inputs come
 * from the one `activityQueryInputs` (04-hydration.md §4 rules 2 and 11) —
 * so the first paint makes no `/api/trpc` call.
 */
const ActivityView = () => {
  const trpc = useTRPC();
  const [filters, setFilters] = useActivityFilters();
  const [isPending, startTransition] = useTransition();
  const inputs = activityQueryInputs(filters);

  const { data: counts } = useSuspenseQuery(
    trpc.activity.getDayCounts.queryOptions(inputs.counts),
  );
  const { data: staffOptions } = useSuspenseQuery(
    trpc.activity.getStaff.queryOptions(),
  );
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSuspenseInfiniteQuery(
      trpc.activity.getDay.infiniteQueryOptions(inputs.day, {
        getNextPageParam: getNextActivityCursor,
      }),
    );

  const items = data.pages.flatMap((page) => page.items);

  // A new day or filter re-keys the reads, which suspend. Inside a
  // transition React keeps the current screen meanwhile. Today is written
  // as "" — the URL's default — so a bookmarked «today» stays today.
  const update = (next: { date?: string; staff?: string }) =>
    startTransition(() => {
      void setFilters({
        ...next,
        ...(next.date !== undefined && {
          date: next.date === counts.today ? "" : next.date,
        }),
      });
    });

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 px-4 pb-6 md:px-8">
      <div
        data-pending={isPending ? "" : undefined}
        className="flex min-w-0 flex-col gap-3 data-pending:opacity-70"
      >
        <ActivityToolbar
          selected={counts.selected}
          today={counts.today}
          staff={filters.staff}
          staffOptions={staffOptions}
          onDayChange={(date) => update({ date })}
          onStaffChange={(staff) => update({ staff })}
        />
        <WeekStrip
          days={counts.days}
          selected={counts.selected}
          today={counts.today}
          onSelect={(date) => update({ date })}
        />
      </div>

      <section
        aria-busy={isPending}
        className="bg-card min-w-0 rounded-xl border p-4 md:p-6 data-pending:opacity-70"
        data-pending={isPending ? "" : undefined}
      >
        {items.length === 0 ? (
          <div className="py-10">
            <EmptyState
              title={COPY.emptyTitle}
              description={COPY.emptyDescription}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <ActivityTimeline items={items} />
            {hasNextPage && (
              <Button
                variant="outline"
                size="lg"
                className="self-center"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {isFetchingNextPage ? COPY.loadingMore : COPY.showMore}
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export const ActivityViewLoading = () => (
  <LoadingState
    title={COPY.loadingTitle}
    description={COPY.loadingDescription}
  />
);

/**
 * A malformed or future `date` in a hand-edited URL is refused by the
 * procedure. The message itself may be redacted in the dehydrated error, so
 * the fallback offers the way out rather than quoting it: back to today.
 */
export const ActivityViewError = ({ resetErrorBoundary }: FallbackProps) => {
  const { reset } = useQueryErrorResetBoundary();
  const [, setFilters] = useActivityFilters();

  const retry = () => {
    reset();
    resetErrorBoundary();
  };

  return (
    <div className="flex flex-1 flex-col items-center gap-4">
      <ErrorState title={COPY.errorTitle} description={COPY.errorDescription} />
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="default"
          size="lg"
          onClick={() => {
            void setFilters({ date: "" }).then(retry);
          }}
        >
          {COPY.backToToday}
        </Button>
        <Button variant="outline" size="lg" onClick={retry}>
          <RotateCcwIcon />
          {COPY.retry}
        </Button>
      </div>
    </div>
  );
};

export default ActivityView;
