"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";
import { WAITING_ROOM_REFRESH_MS } from "../waiting-room";

/**
 * The waiting room, as the navbar badge and its list both read it — one set
 * of options, so they share one cache entry and one polling timer.
 *
 * `useQuery`, not `useSuspenseQuery`: the badge sits in the navbar of every
 * dashboard route, and suspending it would blank the header while the query
 * streams. `(dashboard)/layout.tsx` prefetches the exact same key
 * (`getWaitingRoom.queryOptions()`, no input), so the first paint makes no
 * request — the documented exception to 04-hydration.md §4 rule 5.
 *
 * Its key sits under `appointments.pathFilter()`: every status change, from
 * whichever screen, refreshes it through `useInvalidateAppointments`.
 */
export const useWaitingRoom = () => {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.appointments.getWaitingRoom.queryOptions(),
    refetchInterval: WAITING_ROOM_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
};
