import { createLoader, parseAsString } from "nuqs/server";

/**
 * SERVER half of the /parametres URL state. `hooks/use-clinic-filters.ts`
 * declares the same key, parser and default — `npm run check:filters` fails
 * the build if they drift (05-slice.md §4).
 *
 * `section` is a plain string, not a literal union: each later settings
 * branch adds one section in `page.tsx`, and the shell — not the parser —
 * falls back to the first section on an unknown value.
 */
export const filterSearchParams = {
  section: parseAsString
    .withDefault("general")
    .withOptions({ clearOnDefault: true }),
};

export const loadSearchParams = createLoader(filterSearchParams);
