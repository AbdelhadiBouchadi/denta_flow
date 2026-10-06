"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { INSURER_COPY } from "../constants";
import { InsurerForm } from "./insurer-form";

interface NewInsurerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Every modal goes through ResponsiveDialog (06-ui.md §7). */
const NewInsurerDialog = ({ open, onOpenChange }: NewInsurerDialogProps) => (
  <ResponsiveDialog
    title={INSURER_COPY.newTitle}
    description={INSURER_COPY.newDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <InsurerForm
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default NewInsurerDialog;
