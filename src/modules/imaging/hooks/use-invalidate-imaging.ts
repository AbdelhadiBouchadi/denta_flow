"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2) — register,
 * update and remove all call exactly this.
 *
 * - `imaging.pathFilter()` — router-wide: every kind filter of every
 *   patient's gallery, so a re-filed image leaves one chip and joins another;
 * - `activity.pathFilter()` — each of the three writes adds an «Activité du
 *   jour» line.
 *
 * Not `patients`: no figure of the dossier depends on its images (the
 * header carries no image count, by design).
 */
export const useInvalidateImaging = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.imaging.pathFilter()),
      queryClient.invalidateQueries(trpc.activity.pathFilter()),
    ]);
  }, [queryClient, trpc]);
};
