"use client";

import { useMutation } from "@tanstack/react-query";
import {
  CircleCheckIcon,
  CircleOffIcon,
  MoreHorizontalIcon,
  PencilIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import { INSURER_COPY } from "../constants";
import { useInvalidateInsurers } from "../hooks/use-invalidate-insurers";
import type { InsurerListItem } from "../types";
import UpdateInsurerDialog from "./update-insurer-dialog";

interface InsurerActionsProps {
  insurer: InsurerListItem;
}

/**
 * A row's menu, rendered for admins only — a courtesy: every procedure behind
 * it is an `adminProcedure`.
 *
 * Deactivate and reactivate are a plain toggle with a toast, no confirmation:
 * nothing is lost, and the other one undoes it.
 */
const InsurerActions = ({ insurer }: InsurerActionsProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateInsurers();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const deactivate = useMutation(
    trpc.insurers.deactivate.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(INSURER_COPY.deactivated);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const reactivate = useMutation(
    trpc.insurers.reactivate.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(INSURER_COPY.reactivated);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const isPending = deactivate.isPending || reactivate.isPending;

  return (
    <>
      <UpdateInsurerDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        initialValues={insurer}
      />

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                disabled={isPending}
                aria-label={`${INSURER_COPY.actionsLabel} ${insurer.name}`}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
              <PencilIcon />
              {INSURER_COPY.edit}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {insurer.isActive ? (
              <DropdownMenuItem
                onClick={() => deactivate.mutate({ id: insurer.id })}
              >
                <CircleOffIcon />
                {INSURER_COPY.deactivate}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => reactivate.mutate({ id: insurer.id })}
              >
                <CircleCheckIcon />
                {INSURER_COPY.reactivate}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default InsurerActions;
