"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { PRESCRIPTION_COPY as COPY } from "../constants";
import type { MedicationListItem } from "../types";
import { MedicationForm } from "./medication-form";

interface MedicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ «Modifier le médicament». */
  initialValues?: MedicationListItem;
}

/** Every modal goes through ResponsiveDialog (06-ui.md §7). */
const MedicationDialog = ({
  open,
  onOpenChange,
  initialValues,
}: MedicationDialogProps) => (
  <ResponsiveDialog
    title={initialValues ? COPY.editMedicationTitle : COPY.newMedicationTitle}
    description={COPY.medicationDialogDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <MedicationForm
      initialValues={initialValues}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default MedicationDialog;
