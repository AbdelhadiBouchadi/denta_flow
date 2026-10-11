"use client";

import { parseAsString, useQueryStates } from "nuqs";

/**
 * CLIENT half of the `/activite` URL state — it MIRRORS params.ts exactly.
 * Changing a parser here without changing it there means the server
 * prefetches one cache entry and the client subscribes to another.
 */
export const useActivityFilters = () =>
  useQueryStates({
    date: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    staff: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  });
