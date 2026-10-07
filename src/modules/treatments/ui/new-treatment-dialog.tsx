"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { TREATMENT_COPY } from "../constants";
import type { TreatmentFormDefaults } from "../form-values";
import { TreatmentForm } from "./treatment-form";

interface NewTreatmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Create-mode pre-fill: the dossier's patient, the odontogram's teeth. */
  defaultValues?: TreatmentFormDefaults;
  /** Record for `defaultValues.patient` only — the dossier's button. */
  lockPatient?: boolean;
}

/** Every modal goes through ResponsiveDialog (06-ui.md §7). */
const NewTreatmentDialog = ({
  open,
  onOpenChange,
  defaultValues,
  lockPatient,
}: NewTreatmentDialogProps) => (
  <ResponsiveDialog
    title={TREATMENT_COPY.newTitle}
    description={TREATMENT_COPY.newDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <TreatmentForm
      defaultValues={defaultValues}
      lockPatient={lockPatient}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default NewTreatmentDialog;
