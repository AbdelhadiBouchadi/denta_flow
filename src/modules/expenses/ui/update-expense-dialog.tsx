"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { EXPENSE_COPY } from "../constants";
import type { ExpenseListItem } from "../types";
import { ExpenseForm } from "./expense-form";

interface UpdateExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ the one form runs in edit mode (06-ui.md §5). */
  initialValues: ExpenseListItem;
}

const UpdateExpenseDialog = ({
  open,
  onOpenChange,
  initialValues,
}: UpdateExpenseDialogProps) => (
  <ResponsiveDialog
    title={EXPENSE_COPY.editTitle}
    description={EXPENSE_COPY.editDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <ExpenseForm
      initialValues={initialValues}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default UpdateExpenseDialog;
