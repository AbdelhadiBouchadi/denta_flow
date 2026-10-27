"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2). Every WhatsApp
 * mutation — manual send, retry, rules, templates, settings, test, backfill,
 * bulk consent — calls exactly this:
 *
 * - `whatsapp.pathFilter()` — every read of the slice («Rappels», the
 *   journal, the service status, the appointment badge, the attention count);
 * - `dashboard.pathFilter()` — the «Messages WhatsApp à vérifier» card;
 * - `patients.pathFilter()` — the bulk consent action changes the list's
 *   consent filter results;
 * - `activity.pathFilter()` — every human action here writes a line.
 *
 * No `setQueryData`, no optimistic update.
 */
export const useInvalidateWhatsapp = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.whatsapp.pathFilter()),
      queryClient.invalidateQueries(trpc.dashboard.pathFilter()),
      queryClient.invalidateQueries(trpc.patients.pathFilter()),
      queryClient.invalidateQueries(trpc.activity.pathFilter()),
    ]);
  }, [queryClient, trpc]);
};
