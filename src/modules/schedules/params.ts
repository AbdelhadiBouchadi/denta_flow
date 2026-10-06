import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/**
 * SERVER half of the «Horaires» URL state. `hooks/use-schedules-filters.ts`
 * declares the same keys, parsers and defaults — `npm run check:filters`
 * fails the build if they drift (05-slice.md §4).
 *
 * `practitionerId` "" means «not chosen»: `schedules.getWeek` then resolves
 * the signed-in practitioner, or the first active one. The page passes the
 * same value through, so the prefetched key is the key the view reads.
 */
export const filterSearchParams = {
  practitionerId: parseAsString
    .withDefault("")
    .withOptions({ clearOnDefault: true }),
  includePast: parseAsBoolean
    .withDefault(false)
    .withOptions({ clearOnDefault: true }),
};

export const loadSearchParams = createLoader(filterSearchParams);
