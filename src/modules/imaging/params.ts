import { createLoader, parseAsStringLiteral } from "nuqs/server";

import { PATIENT_FILE_KIND_VALUES } from "./constants";

/**
 * SERVER half of the «Imagerie» tab's URL state. `hooks/use-imaging-filters.ts`
 * declares the same keys, parsers and defaults — two halves of one query
 * key, checked by `npm run check:filters` (05-slice.md §4).
 *
 * The key is `imageKind`, not `kind`: it shares the dossier's URL with the
 * other tabs' state (`tab`), so it names its tab. `null` ⇒ every kind.
 */
export const filterSearchParams = {
  imageKind: parseAsStringLiteral(PATIENT_FILE_KIND_VALUES).withOptions({
    clearOnDefault: true,
  }),
};

export const loadSearchParams = createLoader(filterSearchParams);
