"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { EXCEPTION_COPY } from "../constants";
import type { ScheduleExceptionListItem } from "../types";
import { ExceptionForm } from "./exception-form";

interface UpdateExceptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ the one form runs in edit mode (06-ui.md §5). */
  initialValues: ScheduleExceptionListItem;
}

const UpdateExceptionDialog = ({
  open,
  onOpenChange,
  initialValues,
}: UpdateExceptionDialogProps) => (
  <ResponsiveDialog
    title={EXCEPTION_COPY.editTitle}
    description={EXCEPTION_COPY.editDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <ExceptionForm
      initialValues={initialValues}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default UpdateExceptionDialog;
