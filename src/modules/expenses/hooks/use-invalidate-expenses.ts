"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2) — create,
 * update, duplicate and remove all call exactly this.
 *
 * - `expenses.pathFilter()` — `/charges` pages, the summary strip, `getOne`;
 * - `dashboard.pathFilter()` — «Charges» and «Bénéfice net» in the admin
 *   block, so the net moves without a reload.
 *
 * No `setQueryData`, no optimistic update on money.
 */
export const useInvalidateExpenses = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.expenses.pathFilter()),
      queryClient.invalidateQueries(trpc.dashboard.pathFilter()),
    ]);
  }, [queryClient, trpc]);
};
