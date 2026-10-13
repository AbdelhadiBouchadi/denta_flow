"use client";

import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import {
  DEFAULT_STATISTICS_PERIOD,
  STATISTICS_PERIOD_VALUES,
} from "../constants";

/**
 * CLIENT half of `/statistiques`' URL state — it MIRRORS params.ts exactly,
 * or the server prefetches one cache entry and the client subscribes to
 * another.
 */
export const useStatisticsFilters = () =>
  useQueryStates({
    period: parseAsStringLiteral(STATISTICS_PERIOD_VALUES)
      .withDefault(DEFAULT_STATISTICS_PERIOD)
      .withOptions({ clearOnDefault: true }),
    from: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    to: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  });
