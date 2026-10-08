"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";
import { DASHBOARD_REFETCH_INTERVAL_MS } from "../rules";
import { useDashboardFilters } from "./use-dashboard-filters";

/**
 * The dashboard is left open all day at the desk. Observer options only —
 * they are not part of the query key, so the prefetched entry still hits.
 *
 * - every 60 s while the tab is visible (no polling in a background tab);
 * - on EVERY focus, not only once stale: a payment recorded in another tab
 *   invalidates that tab's cache, not this one's.
 *
 * The server recomputes «today» on each call, so the first refetch after
 * midnight shows the new day.
 */
const LIVE = {
  refetchInterval: DASHBOARD_REFETCH_INTERVAL_MS,
  refetchOnWindowFocus: "always",
} as const;

/** `dashboard.getStats` — the same options `page.tsx` prefetches (no input). */
export const useDashboardStats = () => {
  const trpc = useTRPC();
  return useSuspenseQuery({
    ...trpc.dashboard.getStats.queryOptions(),
    ...LIVE,
  });
};

/**
 * `dashboard.getAdminStats` for the period in the URL — the input
 * `page.tsx` prefetches with, read through the mirrored nuqs parsers. The
 * revenue card and «Encaissements» both call this: one cache entry, one
 * request. Rendered for admins only; a secretary never mounts it.
 */
export const useAdminStats = () => {
  const trpc = useTRPC();
  const [{ period }] = useDashboardFilters();
  return useSuspenseQuery({
    ...trpc.dashboard.getAdminStats.queryOptions({ period }),
    ...LIVE,
  });
};
