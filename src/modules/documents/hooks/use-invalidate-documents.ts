"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2) — generate and
 * remove both call exactly this. A document moves no balance and no acte, so
 * `documents.pathFilter()` covers `/documents` and the dossier tab; the
 * activity feed gets the line each write adds.
 *
 * No `setQueryData`: the list is re-read from the server.
 */
export const useInvalidateDocuments = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.documents.pathFilter()),
      // Generating or removing a document writes an «Activité du jour» line.
      queryClient.invalidateQueries(trpc.activity.pathFilter()),
    ]);
  }, [queryClient, trpc]);
};
