"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2) — generate and
 * remove both call exactly this. A document moves no balance and no acte, so
 * `documents.pathFilter()` alone covers `/documents` and the dossier tab.
 *
 * No `setQueryData`: the list is re-read from the server.
 */
export const useInvalidateDocuments = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(
    () => queryClient.invalidateQueries(trpc.documents.pathFilter()),
    [queryClient, trpc],
  );
};
