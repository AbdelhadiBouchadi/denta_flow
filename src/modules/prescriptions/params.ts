import {
  createLoader,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { DEFAULT_PAGE } from "@/constants";
import {
  MEDICATION_STATUS_FILTER_VALUES,
  MedicationStatusFilter,
} from "./types";

/**
 * SERVER half of the «Médicaments et packs» list URL state.
 * `hooks/use-prescriptions-filters.ts` declares the same keys, parsers and
 * defaults — two halves of one query key, held together by
 * `npm run check:filters` (05-slice.md §4).
 *
 * The keys are prefixed `med`: this section shares `/parametres` with
 * «Actes», whose `search` and `page` would otherwise filter both lists.
 */
export const filterSearchParams = {
  medSearch: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  medStatus: parseAsStringLiteral(MEDICATION_STATUS_FILTER_VALUES)
    .withDefault(MedicationStatusFilter.All)
    .withOptions({ clearOnDefault: true }),
  medPage: parseAsInteger
    .withDefault(DEFAULT_PAGE)
    .withOptions({ clearOnDefault: true }),
};

export const loadSearchParams = createLoader(filterSearchParams);
