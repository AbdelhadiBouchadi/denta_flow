"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { TASK_COPY as COPY } from "../constants";
import type { TaskListItem } from "../types";
import { TaskForm } from "./task-form";

interface UpdateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues: TaskListItem;
}

const UpdateTaskDialog = ({
  open,
  onOpenChange,
  initialValues,
}: UpdateTaskDialogProps) => (
  <ResponsiveDialog
    title={COPY.editTitle}
    description={COPY.editDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <TaskForm
      initialValues={initialValues}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default UpdateTaskDialog;
