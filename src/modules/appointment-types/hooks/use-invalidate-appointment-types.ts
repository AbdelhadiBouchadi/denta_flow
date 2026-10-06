"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2). Create, update,
 * deactivate and reactivate all call exactly this. Branch 18 adds the agenda's
 * appointment queries here: a recoloured type repaints its blocks.
 */
export const useInvalidateAppointmentTypes = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await queryClient.invalidateQueries(
      trpc.appointmentTypes.getMany.queryFilter(),
    );
  }, [queryClient, trpc]);
};
