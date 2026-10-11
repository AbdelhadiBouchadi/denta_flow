"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2) — save, reset
 * and «Recharger» all call exactly this.
 *
 * - `odontogram.pathFilter()` — the chart itself;
 * - `activity.pathFilter()` — every save and reset writes an «Activité du
 *   jour» line.
 *
 * Not `patients`: no figure of the dossier depends on the chart — the acte
 * list stays the clinical record of truth (08-clinical.md §2 rule 4).
 */
export const useInvalidateOdontogram = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.odontogram.pathFilter()),
      queryClient.invalidateQueries(trpc.activity.pathFilter()),
    ]);
  }, [queryClient, trpc]);
};
