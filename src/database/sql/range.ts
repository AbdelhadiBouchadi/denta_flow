import { and, gte, lt, type Column } from "drizzle-orm";

/**
 * A `timestamptz` column inside `[start, end)` — the ONE range predicate
 * behind every money figure: payments' `paidAt` (receivables.ts) and
 * expenses' `spentAt` (expenses.ts). Revenue and charges over «the same
 * period» are therefore bounded by literally the same comparison.
 *
 * Either bound may be absent (an open-ended list filter). The bounds are
 * instants drawn in TypeScript through the clinic timezone
 * (`src/lib/time.ts`), never a date computed by the database, which runs in
 * UTC.
 *
 * Free of `db` and `server-only`: a predicate only, composed into each
 * caller's own query.
 */
export interface OptionalInstantRange {
  start?: Date;
  end?: Date;
}

export const inInstantRange = (
  column: Column,
  { start, end }: OptionalInstantRange,
) =>
  and(
    start ? gte(column, start) : undefined,
    end ? lt(column, end) : undefined,
  );
