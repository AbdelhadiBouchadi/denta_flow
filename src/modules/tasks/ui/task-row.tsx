"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import StatusBadge from "@/components/shared/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { TASK_COPY as COPY } from "../constants";
import { useInvalidateTasks } from "../hooks/use-invalidate-tasks";
import { dueBadge } from "../rules";
import type { TaskListItem } from "../types";
import { ImportanceToggle } from "./importance-toggle";
import TaskActions from "./task-actions";

interface TaskRowProps {
  task: TaskListItem;
}

/**
 * One task: checkbox, content (wraps, never overflows), due-date badge, the
 * author, the star, the ⋮ menu. Nothing moves until the refetch: the row
 * changes list when the server says it is done, not when the box is ticked.
 */
const TaskRow = ({ task }: TaskRowProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateTasks();

  const onError = async (error: unknown) => {
    toast.error(getErrorMessage(error));
    await invalidateAll();
  };

  // The checkbox sends the state it SHOWS the user asking for — a set, so a
  // second tap while the first is in flight cannot flip it back.
  const setDone = useMutation(
    trpc.tasks.setDone.mutationOptions({ onSuccess: invalidateAll, onError }),
  );
  // The star is an edit like any other: same token, same CONFLICT.
  const updateTask = useMutation(
    trpc.tasks.update.mutationOptions({ onSuccess: invalidateAll, onError }),
  );

  const badge = dueBadge(task);
  const checkboxId = `task-${task.id}`;

  return (
    <li
      data-done={task.isDone ? "" : undefined}
      className="flex items-start gap-3 px-4 py-3"
    >
      <Checkbox
        id={checkboxId}
        checked={task.isDone}
        disabled={setDone.isPending}
        onCheckedChange={(checked) =>
          setDone.mutate({ id: task.id, isDone: checked === true })
        }
        aria-label={task.isDone ? COPY.markOpen : COPY.markDone}
        className="mt-0.5"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label
          htmlFor={checkboxId}
          className={cn(
            "text-sm leading-snug break-words whitespace-pre-wrap [overflow-wrap:anywhere]",
            task.isDone
              ? "text-muted-foreground line-through"
              : "text-foreground",
          )}
        >
          {task.content}
        </label>

        {(badge || task.createdBy) && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {badge && (
              <StatusBadge
                label={badge.label}
                tone={badge.tone}
                className={cn("tabular-nums", task.isDone && "opacity-70")}
              />
            )}
            {task.createdBy && (
              <span className="min-w-0 truncate">
                {COPY.createdBy(task.createdBy)}
              </span>
            )}
          </div>
        )}
      </div>

      <ImportanceToggle
        pressed={task.isImportant}
        disabled={task.isDone || updateTask.isPending}
        onPressedChange={(isImportant) =>
          updateTask.mutate({
            id: task.id,
            content: task.content,
            dueDate: task.dueDate,
            isImportant,
            expectedUpdatedAt: task.updatedAt,
          })
        }
        className="-my-1"
      />
      <div className="-my-1">
        <TaskActions task={task} />
      </div>
    </li>
  );
};

export default TaskRow;
