"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2). Create, update,
 * deactivate and reactivate all call exactly this.
 *
 * Patients are refreshed too: their dossier shows the insurer's name, and a
 * rename must reach it.
 */
export const useInvalidateInsurers = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await queryClient.invalidateQueries(trpc.insurers.getMany.queryFilter());
    await queryClient.invalidateQueries(trpc.patients.getMany.queryFilter());
    await queryClient.invalidateQueries(trpc.patients.getOne.queryFilter());
  }, [queryClient, trpc]);
};
