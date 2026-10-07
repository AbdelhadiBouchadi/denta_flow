"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { APPOINTMENT_COPY } from "../constants";
import type { AppointmentListItem } from "../types";
import { AppointmentForm } from "./appointment-form";

interface UpdateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ the one form runs in edit mode (06-ui.md §5). */
  initialValues: AppointmentListItem;
}

const UpdateAppointmentDialog = ({
  open,
  onOpenChange,
  initialValues,
}: UpdateAppointmentDialogProps) => (
  <ResponsiveDialog
    title={APPOINTMENT_COPY.editTitle}
    description={APPOINTMENT_COPY.editDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <AppointmentForm
      initialValues={initialValues}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default UpdateAppointmentDialog;
