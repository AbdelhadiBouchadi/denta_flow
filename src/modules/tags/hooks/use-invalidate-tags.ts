"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2). Create, update
 * and remove all call exactly this.
 *
 * Patients are refreshed too: their rows and dossiers carry tag pills, and a
 * renamed, recoloured or deleted tag must not linger there.
 */
export const useInvalidateTags = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await queryClient.invalidateQueries(trpc.tags.getMany.queryFilter());
    await queryClient.invalidateQueries(trpc.patients.getMany.queryFilter());
    await queryClient.invalidateQueries(trpc.patients.getOne.queryFilter());
  }, [queryClient, trpc]);
};
