"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { APPOINTMENT_TYPE_COPY } from "../constants";
import type { AppointmentTypeListItem } from "../types";
import { AppointmentTypeForm } from "./appointment-type-form";

interface UpdateAppointmentTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ the one form runs in edit mode (06-ui.md §5). */
  initialValues: AppointmentTypeListItem;
}

const UpdateAppointmentTypeDialog = ({
  open,
  onOpenChange,
  initialValues,
}: UpdateAppointmentTypeDialogProps) => (
  <ResponsiveDialog
    title={APPOINTMENT_TYPE_COPY.editTitle}
    description={APPOINTMENT_TYPE_COPY.editDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <AppointmentTypeForm
      initialValues={initialValues}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default UpdateAppointmentTypeDialog;
