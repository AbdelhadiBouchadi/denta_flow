import { createLoader, parseAsStringLiteral } from "nuqs/server";

import { ALL_TEETH } from "@/modules/odontogram/constants";
import {
  DEFAULT_IMAGING_GROUP_BY,
  IMAGING_GROUP_BY_VALUES,
  PATIENT_FILE_KIND_VALUES,
} from "./constants";

/**
 * SERVER half of the «Imagerie» tab's URL state. `hooks/use-imaging-filters.ts`
 * declares the same keys, parsers and defaults — two halves of one query
 * key, checked by `npm run check:filters` (05-slice.md §4).
 *
 * The keys name their tab (`imageKind`, not `kind`): they share the
 * dossier's URL with the other tabs' state (`tab`). English keys
 * (AGENTS.md §5) — prompts/32 wrote `groupe` / `dent`.
 *
 * - `imageKind`  — `null` ⇒ every kind; part of the gallery's query key;
 * - `imageTooth` — one FDI code, `null` ⇒ every image; part of the key;
 * - `imageGroup` — «Par date» / «Par type»; a VIEW of the rows, never sent
 *   to the server, so switching it refetches nothing.
 */
export const filterSearchParams = {
  imageKind: parseAsStringLiteral(PATIENT_FILE_KIND_VALUES).withOptions({
    clearOnDefault: true,
  }),
  imageTooth: parseAsStringLiteral(ALL_TEETH).withOptions({
    clearOnDefault: true,
  }),
  imageGroup: parseAsStringLiteral(IMAGING_GROUP_BY_VALUES)
    .withDefault(DEFAULT_IMAGING_GROUP_BY)
    .withOptions({ clearOnDefault: true }),
};

export const loadSearchParams = createLoader(filterSearchParams);
