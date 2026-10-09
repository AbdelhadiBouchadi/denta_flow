import { count, sql, sum, type SQL } from "drizzle-orm";

import { payments } from "@/database/schema";
import { inInstantRange, type OptionalInstantRange } from "./range";

/**
 * The clinic's money figures — the ONE definition of each (prompts/22).
 * `payments.getSummary` and `dashboard.getAdminStats` both select through
 * these fragments, so «Reste à encaisser», «Avances» and the revenue of a
 * period can never read differently on two screens.
 *
 * Free of `db` and `server-only`, like `billable.ts`: fragments only,
 * composed into each caller's own query.
 */

/**
 * `paidAt` inside `[start, end)`. Either bound may be absent (an open-ended
 * `/paiements` filter). The predicate is the shared one (`range.ts`), the
 * same that bounds the charges of a period.
 */
export const paidInRange = (range: OptionalInstantRange) =>
  inInstantRange(payments.paidAt, range);

/**
 * Revenue = SUM(amountCents) of the payments selected, every method included
 * — an insurance reimbursement is cash received, and so is an advance.
 * Select FROM payments WHERE `paidInRange(range)`.
 */
export const revenueColumns = {
  revenueCents: sql<number>`COALESCE(${sum(payments.amountCents)}, 0)::int`,
  paymentCount: count(),
};

/**
 * Balances as of now, summed over every patient (archived ones included: a
 * debt is a debt). Select FROM patients.
 *
 * - outstanding: SUM of GREATEST(remaining, 0) — one patient's advance never
 *   hides another's debt;
 * - advances: the credits, summed apart, as a positive amount.
 *
 * `remainingCents` is the patients slice's own correlated expression (billable
 * actes − payments, `billable.ts`), passed in rather than rewritten here so
 * there is exactly one balance in the codebase.
 */
export const receivablesColumns = (remainingCents: SQL<number>) => ({
  outstandingCents: sql<number>`COALESCE(SUM(GREATEST(${remainingCents}, 0)), 0)::int`,
  advancesCents: sql<number>`COALESCE(SUM(GREATEST(-(${remainingCents}), 0)), 0)::int`,
});
