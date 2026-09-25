"use client";

import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";

import { DEFAULT_PAGE } from "@/constants";

/**
 * CLIENT half of the patients list URL state — it MIRRORS params.ts exactly.
 * Changing a parser here without changing it there means the server prefetches
 * one cache entry and the client subscribes to another: no error, just the
 * wrong page of patients.
 */
export const usePatientsFilters = () =>
  useQueryStates({
    search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    tagId: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    insurerId: parseAsString
      .withDefault("")
      .withOptions({ clearOnDefault: true }),
    page: parseAsInteger
      .withDefault(DEFAULT_PAGE)
      .withOptions({ clearOnDefault: true }),
  });
