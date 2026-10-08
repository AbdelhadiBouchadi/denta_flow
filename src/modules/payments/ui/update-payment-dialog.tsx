"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { PAYMENT_COPY } from "../constants";
import type { PaymentListItem } from "../types";
import { PaymentForm } from "./payment-form";

interface UpdatePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ the one form runs in edit mode (06-ui.md §5). */
  initialValues: PaymentListItem;
}

const UpdatePaymentDialog = ({
  open,
  onOpenChange,
  initialValues,
}: UpdatePaymentDialogProps) => (
  <ResponsiveDialog
    title={PAYMENT_COPY.editTitle}
    description={PAYMENT_COPY.editDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <PaymentForm
      initialValues={initialValues}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default UpdatePaymentDialog;
