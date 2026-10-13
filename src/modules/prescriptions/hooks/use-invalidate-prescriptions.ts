"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2): every
 * medication and pack write calls exactly this.
 *
 * Router-wide `pathFilter()` keys, on purpose: a medication edit changes the
 * label a pack shows, a deactivation flags a pack line — so both routers are
 * re-read together. The activity feed gets the line each write adds. No
 * `setQueryData`: the lists are re-read from the server.
 */
export const useInvalidatePrescriptions = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.medications.pathFilter()),
      queryClient.invalidateQueries(trpc.prescriptionPacks.pathFilter()),
      queryClient.invalidateQueries(trpc.activity.pathFilter()),
    ]);
  }, [queryClient, trpc]);
};
