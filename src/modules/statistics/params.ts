import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

import {
  DEFAULT_STATISTICS_PERIOD,
  STATISTICS_PERIOD_VALUES,
} from "./constants";

/**
 * SERVER half of `/statistiques`' URL state. `hooks/use-statistics-filters.ts`
 * declares the same keys, parsers and defaults — two halves of one query
 * key, checked by `npm run check:filters` (05-slice.md §4).
 *
 * `from` / `to` are clinic calendar days, read only when `period=custom`.
 * They are validated by `statisticsInputSchema`, not here: a malformed day
 * must reach the schema to be refused with its French message.
 */
export const filterSearchParams = {
  period: parseAsStringLiteral(STATISTICS_PERIOD_VALUES)
    .withDefault(DEFAULT_STATISTICS_PERIOD)
    .withOptions({ clearOnDefault: true }),
  from: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  to: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
};

export const loadSearchParams = createLoader(filterSearchParams);
