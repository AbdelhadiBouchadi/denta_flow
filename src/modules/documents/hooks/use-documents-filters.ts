"use client";

import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

import { DEFAULT_PAGE } from "@/constants";
import { GENERATED_DOCUMENT_TYPE_VALUES } from "../constants";

/**
 * CLIENT half of the `/documents` URL state — it MIRRORS params.ts exactly.
 * Changing a parser here without changing it there means the server
 * prefetches one cache entry and the client subscribes to another.
 */
export const useDocumentsFilters = () =>
  useQueryStates({
    search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    type: parseAsStringLiteral(GENERATED_DOCUMENT_TYPE_VALUES).withOptions({
      clearOnDefault: true,
    }),
    from: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    to: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    page: parseAsInteger
      .withDefault(DEFAULT_PAGE)
      .withOptions({ clearOnDefault: true }),
  });
