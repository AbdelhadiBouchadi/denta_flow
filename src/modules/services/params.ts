import {
  createLoader,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { DEFAULT_PAGE } from "@/constants";
import {
  SERVICE_CATEGORY_VALUES,
  SERVICE_STATUS_FILTER_VALUES,
  ServiceStatusFilter,
} from "./types";

/**
 * SERVER half of the «Actes» list URL state. `hooks/use-services-filters.ts`
 * declares the same keys, the same parsers and the same defaults — two halves
 * of one query key, held together by `npm run check:filters` (05-slice.md §4).
 *
 * The literal lists are the ones the `getMany` Zod input reads, so a value the
 * URL accepts is always a value the procedure accepts.
 */
export const filterSearchParams = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  category: parseAsStringLiteral(SERVICE_CATEGORY_VALUES).withOptions({
    clearOnDefault: true,
  }),
  status: parseAsStringLiteral(SERVICE_STATUS_FILTER_VALUES)
    .withDefault(ServiceStatusFilter.All)
    .withOptions({ clearOnDefault: true }),
  page: parseAsInteger
    .withDefault(DEFAULT_PAGE)
    .withOptions({ clearOnDefault: true }),
};

export const loadSearchParams = createLoader(filterSearchParams);
