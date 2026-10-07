"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { PAYMENT_COPY } from "../constants";
import type { PaymentFormDefaults } from "../form-values";
import { PaymentForm } from "./payment-form";

interface NewPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Create-mode pre-fill: the dossier's patient. */
  defaultValues?: PaymentFormDefaults;
  /** Record for `defaultValues.patient` only — the dossier's button. */
  lockPatient?: boolean;
}

/** «Encaisser». Every modal goes through ResponsiveDialog (06-ui.md §7). */
const NewPaymentDialog = ({
  open,
  onOpenChange,
  defaultValues,
  lockPatient,
}: NewPaymentDialogProps) => (
  <ResponsiveDialog
    title={PAYMENT_COPY.newTitle}
    description={PAYMENT_COPY.newDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    {/* Mounted while open only: each opening is a fresh form dated now. */}
    {open && (
      <PaymentForm
        defaultValues={defaultValues}
        lockPatient={lockPatient}
        onSuccess={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
      />
    )}
  </ResponsiveDialog>
);

export default NewPaymentDialog;
