"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2). `setWeek` and
 * every exception write call exactly this: «Appliquer la semaine à…» writes
 * another practitioner's week, so every `getWeek` key goes, not just one.
 */
export const useInvalidateSchedules = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await queryClient.invalidateQueries(trpc.schedules.getWeek.queryFilter());
    await queryClient.invalidateQueries(
      trpc.schedules.getExceptions.queryFilter(),
    );
  }, [queryClient, trpc]);
};
