"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import type { PatientGetOne } from "../types";
import { MedicalHistoryForm } from "./medical-history-form";

interface UpdateMedicalHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientGetOne;
}

/**
 * One dialog whether the history exists or not: the write is an upsert, so
 * there is no «new» form to keep in step with an «edit» one.
 */
const UpdateMedicalHistoryDialog = ({
  open,
  onOpenChange,
  patient,
}: UpdateMedicalHistoryDialogProps) => (
  <ResponsiveDialog
    title="Dossier médical"
    description="Antécédents, traitements et points de vigilance à connaître avant tout acte."
    open={open}
    onOpenChange={onOpenChange}
  >
    <MedicalHistoryForm
      patient={patient}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default UpdateMedicalHistoryDialog;
