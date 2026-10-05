"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { STAFF_COPY } from "../constants";
import type { StaffCreated } from "../types";
import { StaffForm } from "./staff-form";

interface NewStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hands the one-time password to the dialog that shows it. */
  onCreated: (created: StaffCreated) => void;
}

/**
 * Every modal goes through ResponsiveDialog — Dialog on desktop, Drawer on
 * mobile. A slice never imports Dialog directly (06-ui.md §7).
 */
const NewStaffDialog = ({
  open,
  onOpenChange,
  onCreated,
}: NewStaffDialogProps) => (
  <ResponsiveDialog
    title={STAFF_COPY.newTitle}
    description={STAFF_COPY.newDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <StaffForm
      onSuccess={(created) => {
        onOpenChange(false);
        if (created) onCreated(created);
      }}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default NewStaffDialog;
