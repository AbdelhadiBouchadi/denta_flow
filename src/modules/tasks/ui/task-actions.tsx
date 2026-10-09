"use client";

import { useMutation } from "@tanstack/react-query";
import { MoreVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react";
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
import { TASK_COPY as COPY } from "../constants";
import { useInvalidateTasks } from "../hooks/use-invalidate-tasks";
import type { TaskListItem } from "../types";
import UpdateTaskDialog from "./update-task-dialog";

interface TaskActionsProps {
  task: TaskListItem;
}

/**
 * A row's ⋮ menu: «Modifier» for everyone, «Supprimer» where the server
 * would accept it (`canRemove`, computed by `getMany` from `remove`'s own
 * rule). Cosmetic: `remove` re-checks and answers FORBIDDEN.
 */
const TaskActions = ({ task }: TaskActionsProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateTasks();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [RemoveConfirmation, confirmRemove] = useConfirm(
    COPY.removeTitle,
    COPY.removeDescription,
    "destructive",
  );

  const removeTask = useMutation(
    trpc.tasks.remove.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(COPY.removed);
      },
      onError: async (error) => {
        toast.error(getErrorMessage(error));
        await invalidateAll();
      },
    }),
  );

  const handleRemove = async () => {
    if (!(await confirmRemove())) return;
    removeTask.mutate({ id: task.id });
  };

  return (
    <>
      <RemoveConfirmation />
      {/* Mounted while open only: each opening is a fresh form on the row's
          current version. */}
      {isEditOpen && (
        <UpdateTaskDialog
          open
          onOpenChange={setIsEditOpen}
          initialValues={task}
        />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              disabled={removeTask.isPending}
              aria-label={COPY.actionsLabel}
              className="shrink-0"
            />
          }
        >
          <MoreVerticalIcon />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
            <PencilIcon />
            {COPY.edit}
          </DropdownMenuItem>
          {task.canRemove && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void handleRemove()}
              >
                <Trash2Icon />
                {COPY.remove}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

export default TaskActions;
