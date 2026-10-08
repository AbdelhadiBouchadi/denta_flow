import { createLoader, parseAsStringLiteral } from "nuqs/server";

import { DASHBOARD_PERIOD_VALUES, DEFAULT_DASHBOARD_PERIOD } from "./constants";

/**
 * SERVER half of `/tableau-de-bord`'s URL state. `hooks/use-dashboard-filters.ts`
 * declares the same key, parser and default — two halves of one query key,
 * checked by `npm run check:filters` (05-slice.md §4).
 *
 * Only the admin block reads it; a secretary's URL may carry it harmlessly.
 */
export const filterSearchParams = {
  period: parseAsStringLiteral(DASHBOARD_PERIOD_VALUES)
    .withDefault(DEFAULT_DASHBOARD_PERIOD)
    .withOptions({ clearOnDefault: true }),
};

export const loadSearchParams = createLoader(filterSearchParams);
