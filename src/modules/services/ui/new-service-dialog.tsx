"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { SERVICE_COPY } from "../constants";
import { ServiceForm } from "./service-form";

interface NewServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Every modal goes through ResponsiveDialog (06-ui.md §7). */
const NewServiceDialog = ({ open, onOpenChange }: NewServiceDialogProps) => (
  <ResponsiveDialog
    title={SERVICE_COPY.newTitle}
    description={SERVICE_COPY.newDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <ServiceForm
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default NewServiceDialog;
