"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { EXPENSE_COPY } from "../constants";
import type { ExpenseFormDefaults } from "../form-values";
import { ExpenseForm } from "./expense-form";

interface NewExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** «Dupliquer»: the copied row's fields; the date is still today. */
  defaultValues?: ExpenseFormDefaults;
}

/**
 * «Nouvelle charge», and «Dupliquer» — the same create form, prefilled.
 * Every modal goes through ResponsiveDialog (06-ui.md §7).
 */
const NewExpenseDialog = ({
  open,
  onOpenChange,
  defaultValues,
}: NewExpenseDialogProps) => (
  <ResponsiveDialog
    title={defaultValues ? EXPENSE_COPY.duplicateTitle : EXPENSE_COPY.newTitle}
    description={
      defaultValues
        ? EXPENSE_COPY.duplicateDescription
        : EXPENSE_COPY.newDescription
    }
    open={open}
    onOpenChange={onOpenChange}
  >
    {/* Mounted while open only: each opening is a fresh form dated today. */}
    {open && (
      <ExpenseForm
        defaultValues={defaultValues}
        onSuccess={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
      />
    )}
  </ResponsiveDialog>
);

export default NewExpenseDialog;
