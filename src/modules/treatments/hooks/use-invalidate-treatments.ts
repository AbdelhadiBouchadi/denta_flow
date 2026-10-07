"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2) — create, update
 * and remove all call exactly this.
 *
 * Router-wide keys, not per-procedure ones:
 * - `treatments.pathFilter()` — `/actes` pages, the dossier tab, `getOne`;
 * - `patients.pathFilter()` — an acte moves the patient's balance: the
 *   dossier header and strip («Total à payer», «Reste à payer», «Prévu») and
 *   the patients list's «Reste à payer».
 *
 * Branch 20 adds `payments`. No `setQueryData`, no optimistic update on money.
 */
export const useInvalidateTreatments = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.treatments.pathFilter()),
      queryClient.invalidateQueries(trpc.patients.pathFilter()),
    ]);
  }, [queryClient, trpc]);
};
