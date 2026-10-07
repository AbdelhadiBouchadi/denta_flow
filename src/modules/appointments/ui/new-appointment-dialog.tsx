"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { APPOINTMENT_COPY } from "../constants";
import { AppointmentForm } from "./appointment-form";

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Every modal goes through ResponsiveDialog — Dialog on desktop, Drawer on
 * mobile. A slice never imports Dialog directly (06-ui.md §7).
 */
const NewAppointmentDialog = ({
  open,
  onOpenChange,
}: NewAppointmentDialogProps) => (
  <ResponsiveDialog
    title={APPOINTMENT_COPY.newTitle}
    description={APPOINTMENT_COPY.newDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <AppointmentForm
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default NewAppointmentDialog;
