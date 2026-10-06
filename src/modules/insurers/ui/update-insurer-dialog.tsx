"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { INSURER_COPY } from "../constants";
import type { InsurerListItem } from "../types";
import { InsurerForm } from "./insurer-form";

interface UpdateInsurerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ the one form runs in edit mode (06-ui.md §5). */
  initialValues: InsurerListItem;
}

const UpdateInsurerDialog = ({
  open,
  onOpenChange,
  initialValues,
}: UpdateInsurerDialogProps) => (
  <ResponsiveDialog
    title={INSURER_COPY.editTitle}
    description={INSURER_COPY.editDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <InsurerForm
      initialValues={initialValues}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default UpdateInsurerDialog;
