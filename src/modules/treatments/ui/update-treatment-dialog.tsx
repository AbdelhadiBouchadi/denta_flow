"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { TREATMENT_COPY } from "../constants";
import type { TreatmentListItem } from "../types";
import { TreatmentForm } from "./treatment-form";

interface UpdateTreatmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ the one form runs in edit mode (06-ui.md §5). */
  initialValues: TreatmentListItem;
}

const UpdateTreatmentDialog = ({
  open,
  onOpenChange,
  initialValues,
}: UpdateTreatmentDialogProps) => (
  <ResponsiveDialog
    title={TREATMENT_COPY.editTitle}
    description={TREATMENT_COPY.editDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <TreatmentForm
      initialValues={initialValues}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default UpdateTreatmentDialog;
