"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2). A template
 * edit re-reads the templates (the settings list and the builder's picker
 * share `certificateTemplates.getMany`) and the activity feed.
 */
export const useInvalidateCertificateTemplates = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.certificateTemplates.pathFilter()),
      queryClient.invalidateQueries(trpc.activity.pathFilter()),
    ]);
  }, [queryClient, trpc]);
};
