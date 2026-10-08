"use client";

import { useQuery } from "@tanstack/react-query";

import MaskedAmount from "@/components/shared/masked-amount";
import { Card } from "@/components/ui/card";
import { formatCalendarDate } from "@/lib/format";
import { useTRPC } from "@/trpc/client";
import { PAYMENT_SUMMARY_LABELS as S } from "../constants";
import { usePaymentsFilters } from "../hooks/use-payments-filters";
import type { PaymentSummary as PaymentSummaryData } from "../types";

/**
 * The admin header: Total encaissé · Reste à encaisser · Avances, each
 * behind `MaskedAmount` — masked by default, a patient may be standing at the
 * desk. Rendered for admins only, and `payments.getSummary` is an
 * `adminProcedure`: hiding is cosmetic, the refusal is the server's.
 *
 * The period is the list's own `from` / `to`; both empty ⇒ the current month.
 */
const PaymentSummary = () => {
  const trpc = useTRPC();
  const [{ from, to }] = usePaymentsFilters();

  // Prefetched by the route for admins; `useQuery` because the header sits
  // outside the Suspense boundary (04-hydration.md §4 rule 8).
  const { data } = useQuery(trpc.payments.getSummary.queryOptions({ from, to }));
  if (!data) return null;

  return (
    <Card className="grid gap-4 p-4 sm:grid-cols-3">
      <Figure
        label={S.collected}
        hint={`${periodLabel(data.period)} · ${S.count(data.paymentCount)}`}
        cents={data.totalCollectedCents}
      />
      <Figure
        label={S.outstanding}
        hint={S.outstandingHint}
        cents={data.outstandingCents}
        className="text-warning-strong"
      />
      <Figure
        label={S.advances}
        hint={S.advancesHint}
        cents={data.advancesCents}
        className="text-info-strong"
      />
    </Card>
  );
};

const periodLabel = ({ from, to, isCurrentMonth }: PaymentSummaryData["period"]) => {
  if (isCurrentMonth) return S.currentMonth;
  if (from && to) return S.period(formatCalendarDate(from), formatCalendarDate(to));
  if (from) return S.since(formatCalendarDate(from));
  return S.until(formatCalendarDate(to));
};

const Figure = ({
  label,
  hint,
  cents,
  className,
}: {
  label: string;
  hint: string;
  cents: number;
  className?: string;
}) => (
  <div className="flex min-w-0 flex-col gap-1">
    <span className="text-muted-foreground text-sm">{label}</span>
    <MaskedAmount cents={cents} className={`text-lg font-semibold ${className ?? ""}`} />
    <span className="text-muted-foreground text-xs">{hint}</span>
  </div>
);

export default PaymentSummary;
