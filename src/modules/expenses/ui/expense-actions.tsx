"use client";

import { useMutation } from "@tanstack/react-query";
import {
  CopyIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/hooks/use-confirm";
import { getErrorMessage } from "@/lib/errors";
import { formatDH } from "@/lib/format";
import { useTRPC } from "@/trpc/client";
import { EXPENSE_COPY as COPY } from "../constants";
import { useInvalidateExpenses } from "../hooks/use-invalidate-expenses";
import type { ExpenseListItem } from "../types";
import NewExpenseDialog from "./new-expense-dialog";
import UpdateExpenseDialog from "./update-expense-dialog";

/**
 * A row's menu. No role check here: the whole screen is admin-only and every
 * procedure behind these items is `adminProcedure`.
 *
 * «Dupliquer» opens the CREATE form prefilled with the row — label,
 * category, amount, supplier, notes — dated today: next month's rent in two
 * clicks.
 */
const ExpenseActions = ({ expense }: { expense: ExpenseListItem }) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateExpenses();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);

  // Names the effect on the net before the admin decides (decision 6).
  const [RemoveConfirmation, confirmRemove] = useConfirm(
    COPY.removeTitle,
    COPY.removeDescription(formatDH(expense.amountCents)),
    "destructive",
  );

  const removeExpense = useMutation(
    trpc.expenses.remove.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(COPY.removed);
      },
      onError: async (error) => {
        toast.error(getErrorMessage(error));
        await invalidateAll();
      },
    }),
  );

  const handleRemove = async () => {
    if (!(await confirmRemove())) return;
    removeExpense.mutate({ id: expense.id });
  };

  return (
    <>
      <RemoveConfirmation />
      {/* Mounted while open only: each opening is a fresh form on the row's
          current version. */}
      {isEditOpen && (
        <UpdateExpenseDialog
          open
          onOpenChange={setIsEditOpen}
          initialValues={expense}
        />
      )}
      <NewExpenseDialog
        open={isDuplicateOpen}
        onOpenChange={setIsDuplicateOpen}
        defaultValues={{
          label: expense.label,
          category: expense.category,
          amountCents: expense.amountCents,
          supplier: expense.supplier,
          notes: expense.notes,
        }}
      />

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                disabled={removeExpense.isPending}
                aria-label={COPY.actionsLabel}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
              <PencilIcon />
              {COPY.edit}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsDuplicateOpen(true)}>
              <CopyIcon />
              {COPY.duplicate}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => void handleRemove()}
            >
              <Trash2Icon />
              {COPY.remove}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default ExpenseActions;
