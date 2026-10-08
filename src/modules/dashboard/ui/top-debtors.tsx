import Link from "next/link";

import EmptyState from "@/components/shared/empty-state";
import MaskedAmount from "@/components/shared/masked-amount";
import StatusBadge from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { describeBalance } from "@/lib/format";
import { DASHBOARD_COPY as COPY } from "../constants";
import type { DashboardDebtor } from "../types";

interface TopDebtorsProps {
  debtors: DashboardDebtor[];
}

/**
 * «Soldes à recouvrer»: the largest positive balances, ranked by the server
 * (the shared billable rule; archived patients included). Visible to all
 * staff — balances are already in the patients list — but every amount is
 * masked until revealed: a patient may be standing at the desk.
 *
 * Every amount goes through `describeBalance`, the one presentation of a
 * balance, even though the server only ever sends positive ones here.
 */
export const TopDebtors = ({ debtors }: TopDebtorsProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-h4">{COPY.debtorsTitle}</CardTitle>
      <CardDescription>{COPY.debtorsDescription}</CardDescription>
    </CardHeader>
    <CardContent>
      {debtors.length === 0 ? (
        <div className="py-6">
          <EmptyState
            title={COPY.debtorsEmpty}
            description={COPY.debtorsEmptyHint}
          />
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {debtors.map((debtor, index) => (
            <li key={debtor.id} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
              >
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/patients/${debtor.id}`}
                  className="text-foreground truncate font-medium hover:underline"
                >
                  {debtor.name}
                </Link>
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground font-mono text-xs tracking-wider">
                    {debtor.shortCode}
                  </span>
                  {debtor.isArchived && (
                    <StatusBadge label={COPY.archived} tone="neutral" />
                  )}
                </span>
              </div>
              <MaskedAmount
                cents={describeBalance(debtor.remainingCents).amountCents}
                className="text-warning-strong shrink-0 font-semibold"
              />
            </li>
          ))}
        </ol>
      )}
    </CardContent>
  </Card>
);
