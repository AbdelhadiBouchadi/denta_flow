"use client";

import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

import { DEFAULT_PAGE } from "@/constants";
import { TREATMENT_STATUS_VALUES } from "../constants";

/**
 * CLIENT half of the `/actes` URL state — it MIRRORS params.ts exactly.
 * Changing a parser here without changing it there means the server
 * prefetches one cache entry and the client subscribes to another.
 */
export const useTreatmentsFilters = () =>
  useQueryStates({
    search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    status: parseAsStringLiteral(TREATMENT_STATUS_VALUES).withOptions({
      clearOnDefault: true,
    }),
    practitionerId: parseAsString
      .withDefault("")
      .withOptions({ clearOnDefault: true }),
    from: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    to: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    page: parseAsInteger
      .withDefault(DEFAULT_PAGE)
      .withOptions({ clearOnDefault: true }),
  });
