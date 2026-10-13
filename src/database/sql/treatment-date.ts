import { sql, type SQL } from "drizzle-orm";

import { treatments } from "@/database/schema";
import { inInstantRange, type OptionalInstantRange } from "./range";

/**
 * An acte's clinical date — the ONE definition (extracted from the treatments
 * procedures for prompts/30). The date `/actes` and the dossier's «Actes» tab
 * list, filter and sort by, and the date «Production» is attributed to on
 * `/statistiques`: when it was performed, else when it was recorded.
 *
 * `created_at` has no zone and holds UTC, so it is read as UTC explicitly
 * rather than in the session's zone. The result is a `timestamptz`: compare
 * it to instants drawn in TypeScript (`src/lib/time.ts`), never to a day
 * computed by the database.
 *
 * Free of `db` and `server-only`: a fragment only, composed into each
 * caller's own query, which must select FROM `treatments`.
 */
export const treatmentDate: SQL<Date> =
  sql`COALESCE(${treatments.performedAt}, ${treatments.createdAt} AT TIME ZONE 'UTC')`.mapWith(
    treatments.performedAt,
  );

/** The acte's clinical date inside `[start, end)` — the shared range predicate. */
export const treatmentDateInRange = (range: OptionalInstantRange) =>
  inInstantRange(treatmentDate, range);
