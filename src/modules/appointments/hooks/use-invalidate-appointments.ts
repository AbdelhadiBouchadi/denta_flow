"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2).
 *
 * Every appointments mutation — the form's create / update, a status change,
 * a drag on the agenda, remove — calls exactly this. Beyond the slice's own
 * reads, a booking changes the patient row's «Prochain rendez-vous» and the
 * dossier's visit count, so the patients reads are refreshed too.
 *
 * `pathFilter()` is router-wide: every cached input of every appointments
 * procedure — the agenda's ranges, the list's pages, the dossier tab, getOne —
 * and any read added later, with no list here to fall behind. A moved
 * appointment must leave last week's view as well as arrive in this one.
 *
 * No `setQueryData` anywhere, and no optimistic update: invalidate, and let
 * the refetch be the source of truth.
 */
export const useInvalidateAppointments = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.appointments.pathFilter()),
      queryClient.invalidateQueries(trpc.patients.getMany.queryFilter()),
      queryClient.invalidateQueries(trpc.patients.getOne.queryFilter()),
    ]);
  }, [queryClient, trpc]);
};
