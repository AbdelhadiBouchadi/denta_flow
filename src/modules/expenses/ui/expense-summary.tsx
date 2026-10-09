"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import MaskedAmount from "@/components/shared/masked-amount";
import { Card } from "@/components/ui/card";
import { formatCalendarDate } from "@/lib/format";
import { isCalendarDate } from "@/lib/time";
import { useTRPC } from "@/trpc/client";
import { retryUnlessDenied } from "../access";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_SUMMARY_LABELS as S,
} from "../constants";
import { useExpensesFilters } from "../hooks/use-expenses-filters";
import type { ExpenseCategoryShare } from "../types";

/**
 * The strip above the list — Total · Nombre · Première catégorie — then the
 * breakdown by category. Every figure is the server's (`getSummary`, all in
 * SQL) for the list's own filters, minus `page`. Amounts go through
 * `MaskedAmount`; the bars show shares, not amounts.
 *
 * Inside the view's Suspense boundary, prefetched by the route with the same
 * input: a FORBIDDEN here lands on the same forbidden state as the list.
 */
const ExpenseSummary = () => {
  const trpc = useTRPC();
  const [{ search, category, from, to }] = useExpensesFilters();

  const { data } = useSuspenseQuery({
    ...trpc.expenses.getSummary.queryOptions({ search, category, from, to }),
    retry: retryUnlessDenied,
  });

  const top = data.byCategory[0];

  return (
    <div className="flex flex-col gap-4">
      <Card className="grid gap-4 p-4 sm:grid-cols-3">
        <Figure label={S.total} hint={periodLabel(from, to)}>
          <MaskedAmount cents={data.totalCents} className="text-lg font-semibold" />
          {data.previousPeriodTotalCents !== null && (
            <span className="text-muted-foreground flex flex-wrap items-center gap-x-1 text-xs">
              {S.previousPeriod}&nbsp;:
              <MaskedAmount cents={data.previousPeriodTotalCents} />
            </span>
          )}
        </Figure>
        <Figure label={S.count}>
          <span className="text-lg font-semibold tabular-nums">
            {S.countValue(data.count)}
          </span>
        </Figure>
        <Figure
          label={S.topCategory}
          hint={top ? EXPENSE_CATEGORY_LABELS[top.category] : undefined}
        >
          {top ? (
            <MaskedAmount cents={top.totalCents} className="text-lg font-semibold" />
          ) : (
            <span className="text-muted-foreground text-lg font-semibold">
              {S.noTopCategory}
            </span>
          )}
        </Figure>
      </Card>

      {data.byCategory.length > 0 && (
        <Card className="gap-3 p-4">
          <h2 className="text-sm font-medium">{S.breakdownTitle}</h2>
          <ul className="flex flex-col gap-2.5">
            {data.byCategory.map((share) => (
              <CategoryBar key={share.category} share={share} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};

/** «Ce mois-ci»-style caption for the list's own `from` / `to`. */
const periodLabel = (from: string, to: string) => {
  const hasFrom = isCalendarDate(from);
  const hasTo = isCalendarDate(to);
  if (hasFrom && hasTo) {
    return S.period(formatCalendarDate(from), formatCalendarDate(to));
  }
  if (hasFrom) return S.since(formatCalendarDate(from));
  if (hasTo) return S.until(formatCalendarDate(to));
  return S.allTime;
};

const CategoryBar = ({ share }: { share: ExpenseCategoryShare }) => (
  <li className="flex flex-col gap-1">
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="min-w-0 truncate">
        {EXPENSE_CATEGORY_LABELS[share.category]}
      </span>
      <span className="text-muted-foreground shrink-0 tabular-nums">
        {S.share(share.percent)}
      </span>
    </div>
    <div
      aria-hidden="true"
      className="bg-muted h-2 w-full overflow-hidden rounded-full"
    >
      {/* A width, not a colour: the fill is the primary token. */}
      <div
        className="bg-primary h-full rounded-full"
        style={{ width: `${Math.max(share.percent, 1)}%` }}
      />
    </div>
  </li>
);

const Figure = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="flex min-w-0 flex-col gap-1">
    <span className="text-muted-foreground text-sm">{label}</span>
    {children}
    {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
  </div>
);

export default ExpenseSummary;
