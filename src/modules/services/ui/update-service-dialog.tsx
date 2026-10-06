"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { SERVICE_COPY } from "../constants";
import type { ServiceListItem } from "../types";
import { ServiceForm } from "./service-form";

interface UpdateServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ the one form runs in edit mode (06-ui.md §5). */
  initialValues: ServiceListItem;
}

const UpdateServiceDialog = ({
  open,
  onOpenChange,
  initialValues,
}: UpdateServiceDialogProps) => (
  <ResponsiveDialog
    title={SERVICE_COPY.editTitle}
    description={SERVICE_COPY.editDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <ServiceForm
      initialValues={initialValues}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default UpdateServiceDialog;
