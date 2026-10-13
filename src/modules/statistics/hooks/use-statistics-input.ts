"use client";

import { useMemo } from "react";

import { toPeriodInput } from "../period";
import { statisticsInputSchema } from "../schemas";
import { useStatisticsFilters } from "./use-statistics-filters";

/**
 * The input every statistics query is keyed by, read from the URL through
 * the mirrored nuqs parsers and shaped by the SAME `toPeriodInput` the page
 * prefetches with — one key, so the first paint is a cache hit.
 *
 * Validated by the procedures' own schema: an invalid custom range (typed
 * into the URL by hand) yields its French message and no query is made.
 */
export const useStatisticsInput = () => {
  const [filters] = useStatisticsFilters();

  return useMemo(() => {
    const input = toPeriodInput(filters);
    const parsed = statisticsInputSchema.safeParse(input);
    return parsed.success
      ? { input, error: null }
      : { input, error: parsed.error.issues[0]?.message ?? null };
  }, [filters]);
};
