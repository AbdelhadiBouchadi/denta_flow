"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2).
 *
 * Every appointments mutation — create, update, updateStatus, remove — calls
 * exactly this. Beyond the slice's own reads, a booking changes the patient
 * row's «Prochain rendez-vous» and the dossier's visit count, so the patients
 * reads are refreshed too.
 *
 * `queryFilter()` with no input matches every cached input of a procedure: a
 * moved appointment must leave last week's view as well as arrive in this one.
 *
 * No `setQueryData` anywhere, and no optimistic update: invalidate, and let
 * the refetch be the source of truth.
 */
export const useInvalidateAppointments = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.appointments.getMany.queryFilter()),
      queryClient.invalidateQueries(trpc.appointments.getPage.queryFilter()),
      queryClient.invalidateQueries(
        trpc.appointments.getManyByPatient.queryFilter(),
      ),
      queryClient.invalidateQueries(trpc.appointments.getOne.queryFilter()),
      queryClient.invalidateQueries(trpc.patients.getMany.queryFilter()),
      queryClient.invalidateQueries(trpc.patients.getOne.queryFilter()),
    ]);
  }, [queryClient, trpc]);
};
