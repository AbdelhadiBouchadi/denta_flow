"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2). Create, update,
 * deactivate, reactivate and importNgap all call exactly this.
 *
 * `searchNgap` is refreshed too: its «Déjà au catalogue» flag reads the
 * catalogue, and a just-imported act must show it on the next open.
 */
export const useInvalidateServices = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await queryClient.invalidateQueries(trpc.services.getMany.queryFilter());
    await queryClient.invalidateQueries(trpc.services.searchNgap.queryFilter());
  }, [queryClient, trpc]);
};
