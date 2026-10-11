import { createLoader, parseAsString } from "nuqs/server";

/**
 * SERVER half of the `/activite` URL state. `hooks/use-activity-filters.ts`
 * declares the same keys, the same parsers and the same defaults — they are
 * two halves of one query key, and `npm run check:filters` fails the build if
 * they drift (05-slice.md §4).
 *
 * `date` is a clinic calendar day, "" meaning today; `staff` a staff id, ""
 * meaning everyone. Both stay raw strings: the procedure resolves and
 * validates them, so the page and the view key on the same text.
 */
export const filterSearchParams = {
  date: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  staff: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
};

export const loadSearchParams = createLoader(filterSearchParams);
