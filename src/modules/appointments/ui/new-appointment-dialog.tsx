"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { APPOINTMENT_COPY } from "../constants";
import type { AppointmentFormDefaults } from "../form-values";
import { AppointmentForm } from "./appointment-form";

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Create-mode pre-fill: the agenda's slot and practitioner filter. */
  defaultValues?: AppointmentFormDefaults;
  /** Book for `defaultValues.patient` only — the dossier's button. */
  lockPatient?: boolean;
}

/**
 * Every modal goes through ResponsiveDialog — Dialog on desktop, Drawer on
 * mobile. A slice never imports Dialog directly (06-ui.md §7).
 */
const NewAppointmentDialog = ({
  open,
  onOpenChange,
  defaultValues,
  lockPatient,
}: NewAppointmentDialogProps) => (
  <ResponsiveDialog
    title={APPOINTMENT_COPY.newTitle}
    description={APPOINTMENT_COPY.newDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <AppointmentForm
      defaultValues={defaultValues}
      lockPatient={lockPatient}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default NewAppointmentDialog;
