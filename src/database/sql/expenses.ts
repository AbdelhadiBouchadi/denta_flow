import { count, sql, sum } from "drizzle-orm";

import { expenses } from "@/database/schema";
import { inInstantRange, type OptionalInstantRange } from "./range";

/**
 * The clinic's charges — the ONE definition (prompts/26-charges.md).
 * `expenses.getSummary` and `dashboard.getAdminStats` both select through
 * these fragments, so «Charges» on `/charges` and on the dashboard can never
 * read differently for the same period. Revenue has its own single
 * definition in `receivables.ts`; «Bénéfice net» is one minus the other.
 *
 * Free of `db` and `server-only`, like `receivables.ts`.
 */

/**
 * `spentAt` inside `[start, end)`. `spentAt` is stored as the clinic-midnight
 * instant of the charge's day, so a clinic-day range selects exactly the
 * charges dated on those days.
 */
export const spentInRange = (range: OptionalInstantRange) =>
  inInstantRange(expenses.spentAt, range);

/**
 * Charges = SUM(amountCents) of the expenses selected, plus how many there
 * were — the count is what tells «no charge recorded» apart from «charges
 * that sum to zero» (decision 5). Select FROM expenses WHERE `spentInRange`.
 */
export const chargesColumns = {
  chargesCents: sql<number>`COALESCE(${sum(expenses.amountCents)}, 0)::int`,
  expenseCount: count(),
};
