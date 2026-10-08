"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2) — create, update
 * and remove all call exactly this. The widest in the app: a payment moves
 * every balance on screen.
 *
 * Router-wide keys, not per-procedure ones:
 * - `payments.pathFilter()` — `/paiements` pages, the admin totals, the
 *   dossier tab, `getOne`;
 * - `treatments.pathFilter()` — the per-acte allocation («Reste» on `/actes`
 *   and in the dossier, the form's acte picker);
 * - `patients.pathFilter()` — the dossier header chip, the balance strip of
 *   both tabs, and the patients list's «Reste à payer»;
 * - `dashboard.pathFilter()` — today's revenue, the period's revenue, reste
 *   à encaisser, avances and «Soldes à recouvrer».
 *
 * No `setQueryData`, no optimistic update on money.
 */
export const useInvalidatePayments = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.payments.pathFilter()),
      queryClient.invalidateQueries(trpc.treatments.pathFilter()),
      queryClient.invalidateQueries(trpc.patients.pathFilter()),
      queryClient.invalidateQueries(trpc.dashboard.pathFilter()),
    ]);
  }, [queryClient, trpc]);
};
