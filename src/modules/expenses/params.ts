import {
  createLoader,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { DEFAULT_PAGE } from "@/constants";
import { EXPENSE_CATEGORY_VALUES } from "./constants";

/**
 * SERVER half of the `/charges` URL state. `hooks/use-expenses-filters.ts`
 * declares the same keys, the same parsers and the same defaults — they are
 * two halves of one query key, and `npm run check:filters` fails the build if
 * they drift (05-slice.md §4).
 *
 * `from` / `to` are clinic calendar days, "" meaning open-ended. The instants
 * they bound are derived in the procedure, through the clinic timezone. The
 * summary strip reads the same keys minus `page`.
 */
export const filterSearchParams = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  category: parseAsStringLiteral(EXPENSE_CATEGORY_VALUES).withOptions({
    clearOnDefault: true,
  }),
  from: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  to: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  page: parseAsInteger
    .withDefault(DEFAULT_PAGE)
    .withOptions({ clearOnDefault: true }),
};

export const loadSearchParams = createLoader(filterSearchParams);
