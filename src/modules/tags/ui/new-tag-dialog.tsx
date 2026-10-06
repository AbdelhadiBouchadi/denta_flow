"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { TAG_COPY } from "../constants";
import { TagForm } from "./tag-form";

interface NewTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Every modal goes through ResponsiveDialog (06-ui.md §7). */
const NewTagDialog = ({ open, onOpenChange }: NewTagDialogProps) => (
  <ResponsiveDialog
    title={TAG_COPY.newTitle}
    description={TAG_COPY.newDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <TagForm
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default NewTagDialog;
