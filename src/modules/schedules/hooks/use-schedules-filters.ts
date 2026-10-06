"use client";

import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

/**
 * CLIENT half of the «Horaires» URL state — it MIRRORS params.ts exactly.
 * A drift means the server prefetches one cache entry and the client
 * subscribes to another: no error, just the wrong practitioner's week.
 */
export const useSchedulesFilters = () =>
  useQueryStates({
    practitionerId: parseAsString
      .withDefault("")
      .withOptions({ clearOnDefault: true }),
    includePast: parseAsBoolean
      .withDefault(false)
      .withOptions({ clearOnDefault: true }),
  });
