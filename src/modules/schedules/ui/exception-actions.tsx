"use client";

import { useMutation } from "@tanstack/react-query";
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
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
import { useConfirm } from "@/hooks/use-confirm";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import {
  EXCEPTION_COPY,
  exceptionRemoveConfirmDescription,
  formatExceptionPeriod,
} from "../constants";
import { useInvalidateSchedules } from "../hooks/use-invalidate-schedules";
import type { ScheduleExceptionListItem } from "../types";
import UpdateExceptionDialog from "./update-exception-dialog";

interface ExceptionActionsProps {
  exception: ScheduleExceptionListItem;
}

/**
 * A row's menu, rendered for admins only — a courtesy: every procedure behind
 * it is an `adminProcedure`. Remove is a real delete (a closure is
 * configuration, not history), so it is confirmed.
 */
const ExceptionActions = ({ exception }: ExceptionActionsProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateSchedules();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const period = formatExceptionPeriod(exception.period);

  const [RemoveConfirmation, confirmRemove] = useConfirm(
    EXCEPTION_COPY.removeConfirmTitle,
    exceptionRemoveConfirmDescription(period),
    "destructive",
  );

  const remove = useMutation(
    trpc.schedules.removeException.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(EXCEPTION_COPY.removed);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const handleRemove = async () => {
    if (!(await confirmRemove())) return;
    remove.mutate({ id: exception.id });
  };

  return (
    <>
      <RemoveConfirmation />
      <UpdateExceptionDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        initialValues={exception}
      />

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                disabled={remove.isPending}
                aria-label={`${EXCEPTION_COPY.actionsLabel} ${period}`}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
              <PencilIcon />
              {EXCEPTION_COPY.edit}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleRemove}>
              <Trash2Icon />
              {EXCEPTION_COPY.remove}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default ExceptionActions;
