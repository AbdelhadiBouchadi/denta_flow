"use client";

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import { DEFAULT_PAGE } from "@/constants";
import {
  SERVICE_CATEGORY_VALUES,
  SERVICE_STATUS_FILTER_VALUES,
  ServiceStatusFilter,
} from "../types";

/**
 * CLIENT half of the «Actes» list URL state — it MIRRORS params.ts exactly.
 * A drift means the server prefetches one cache entry and the client
 * subscribes to another: no error, just the wrong page of the catalogue.
 */
export const useServicesFilters = () =>
  useQueryStates({
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
  });
