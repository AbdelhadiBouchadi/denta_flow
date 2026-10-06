"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { TAG_COPY } from "../constants";
import type { TagListItem } from "../types";
import { TagForm } from "./tag-form";

interface UpdateTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ the one form runs in edit mode (06-ui.md §5). */
  initialValues: TagListItem;
}

const UpdateTagDialog = ({
  open,
  onOpenChange,
  initialValues,
}: UpdateTagDialogProps) => (
  <ResponsiveDialog
    title={TAG_COPY.editTitle}
    description={TAG_COPY.editDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <TagForm
      initialValues={initialValues}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default UpdateTagDialog;
