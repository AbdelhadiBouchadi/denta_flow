"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2) — create,
 * update, setDone and remove all call exactly this. No other slice reads
 * tasks, so the router-wide key is the whole set.
 *
 * No optimistic update and no `setQueryData`: a completed task moves between
 * the lists when the refetch says so, with the server's order and flags.
 */
export const useInvalidateTasks = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(
    () => queryClient.invalidateQueries(trpc.tasks.pathFilter()),
    [queryClient, trpc],
  );
};
