"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { EXCEPTION_COPY } from "../constants";
import { ExceptionForm } from "./exception-form";

interface NewExceptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Every modal goes through ResponsiveDialog (06-ui.md §7). */
const NewExceptionDialog = ({
  open,
  onOpenChange,
}: NewExceptionDialogProps) => (
  <ResponsiveDialog
    title={EXCEPTION_COPY.newTitle}
    description={EXCEPTION_COPY.newDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <ExceptionForm
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default NewExceptionDialog;
