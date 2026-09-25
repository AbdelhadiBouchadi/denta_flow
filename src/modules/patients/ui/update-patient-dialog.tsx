"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import type { PatientGetOne } from "../types";
import { PatientForm } from "./patient-form";

interface UpdatePatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ the one form runs in edit mode (06-ui.md §5). */
  initialValues: PatientGetOne;
}

const UpdatePatientDialog = ({
  open,
  onOpenChange,
  initialValues,
}: UpdatePatientDialogProps) => (
  <ResponsiveDialog
    title="Modifier le patient"
    description="Mettez à jour les informations du dossier."
    open={open}
    onOpenChange={onOpenChange}
  >
    <PatientForm
      initialValues={initialValues}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default UpdatePatientDialog;
