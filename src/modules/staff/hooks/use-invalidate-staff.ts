"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";

/**
 * The slice's single invalidation block (06-ui.md §6 rule 2). Every staff
 * mutation calls exactly this, so a create and an update can never refresh
 * different things.
 *
 * The session is refetched too: an admin who renames themselves should see the
 * new name in the user menu, which reads Better Auth's session, not tRPC.
 *
 * No `setQueryData`: invalidate, and let the refetch be the source of truth.
 */
export const useInvalidateStaff = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { refetch: refetchSession } = authClient.useSession();

  return useCallback(async () => {
    await queryClient.invalidateQueries(trpc.staff.getMany.queryFilter());
    await refetchSession();
  }, [queryClient, trpc, refetchSession]);
};
