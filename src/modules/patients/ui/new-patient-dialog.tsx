"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { PatientForm } from "./patient-form";

interface NewPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Every modal goes through ResponsiveDialog — Dialog on desktop, Drawer on
 * mobile. A slice never imports Dialog directly (06-ui.md §7).
 */
const NewPatientDialog = ({ open, onOpenChange }: NewPatientDialogProps) => (
  <ResponsiveDialog
    title="Nouveau patient"
    description="Créez un dossier patient. Seuls le nom, le prénom et le téléphone sont obligatoires."
    open={open}
    onOpenChange={onOpenChange}
  >
    <PatientForm
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default NewPatientDialog;
