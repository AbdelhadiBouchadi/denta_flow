"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { STAFF_COPY } from "../constants";
import type { StaffListItem } from "../types";
import { StaffForm } from "./staff-form";

interface UpdateStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ the one form runs in edit mode (06-ui.md §5). */
  initialValues: StaffListItem;
}

const UpdateStaffDialog = ({
  open,
  onOpenChange,
  initialValues,
}: UpdateStaffDialogProps) => (
  <ResponsiveDialog
    title={STAFF_COPY.editTitle}
    description={STAFF_COPY.editDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <StaffForm
      initialValues={initialValues}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default UpdateStaffDialog;
