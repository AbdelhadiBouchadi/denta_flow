"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2).
 *
 * Every patients mutation — create, update, archive, unarchive, remove — calls
 * exactly this. Writing the list out once is what stops a create that refreshes
 * the table from drifting away from an update that forgets the dossier, leaving
 * an edited patient's «reste à payer» showing the old figure.
 *
 * `queryFilter()` with no input matches every cached input of that procedure:
 * a rename has to reach page 3 of a filtered list, not only the page in view.
 *
 * No `setQueryData` anywhere: invalidate, and let the refetch be the source of
 * truth. No optimistic updates on financial figures.
 */
export const useInvalidatePatients = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await queryClient.invalidateQueries(trpc.patients.getMany.queryFilter());
    await queryClient.invalidateQueries(trpc.patients.getOne.queryFilter());
  }, [queryClient, trpc]);
};
