import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";

import { DEFAULT_PAGE } from "@/constants";

/**
 * SERVER half of the patients list URL state. `hooks/use-patients-filters.ts`
 * declares the same keys, the same parsers and the same defaults — they are two
 * halves of one query key, and `npm run check:filters` fails the build if they
 * drift (05-slice.md §4).
 *
 * The dossier's `tab` is deliberately not here: no server prefetch depends on
 * it, so it stays a client-only query state in `hooks/use-patient-tab.ts` and
 * never becomes part of a getMany cache key.
 */
export const filterSearchParams = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  tagId: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  insurerId: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  page: parseAsInteger
    .withDefault(DEFAULT_PAGE)
    .withOptions({ clearOnDefault: true }),
};

export const loadSearchParams = createLoader(filterSearchParams);
