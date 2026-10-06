"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { APPOINTMENT_TYPE_COPY } from "../constants";
import { AppointmentTypeForm } from "./appointment-type-form";

interface NewAppointmentTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Every modal goes through ResponsiveDialog (06-ui.md §7). */
const NewAppointmentTypeDialog = ({
  open,
  onOpenChange,
}: NewAppointmentTypeDialogProps) => (
  <ResponsiveDialog
    title={APPOINTMENT_TYPE_COPY.newTitle}
    description={APPOINTMENT_TYPE_COPY.newDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <AppointmentTypeForm
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default NewAppointmentTypeDialog;
