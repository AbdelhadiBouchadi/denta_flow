"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/components/shared/data-table";
import { formatDate, formatDH } from "@/lib/format";
import { EXPENSE_COLUMN_HEADERS as H, EXPENSE_COPY } from "../constants";
import type { ExpenseCategory, ExpenseListItem } from "../types";
import ExpenseActions from "./expense-actions";
import ExpenseCategoryBadge from "./expense-category-badge";

/** `tabular-nums` is mandatory: amounts stack in a column (06-ui.md §2). */
const AMOUNT = "text-right tabular-nums whitespace-nowrap";

/** Text columns wrap and pad `px-2`, as on `/paiements`, so the table fits. */
const COMPACT = "px-2";
const WRAP = "px-2 whitespace-normal";

/**
 * There is no reference screen for `/charges`: the columns follow
 * prompts/26-charges.md — Date · Libellé (+ fournisseur) · Catégorie ·
 * Montant · actions.
 */
export const columns: ColumnDef<DataTableFeatures, ExpenseListItem>[] = [
  {
    id: "date",
    header: H.date,
    meta: { className: COMPACT },
    cell: ({ row }) => (
      // `spentAt` is the clinic-midnight instant of the charge's day: read on
      // the clinic clock it is that day, in any browser zone.
      <span suppressHydrationWarning className="whitespace-nowrap tabular-nums">
        {formatDate(row.original.spentAt)}
      </span>
    ),
  },
  {
    id: "label",
    header: H.label,
    meta: { className: WRAP },
    cell: ({ row }) => (
      <div className="flex max-w-72 min-w-32 flex-col gap-0.5">
        <span className="leading-snug break-words">{row.original.label}</span>
        <span className="text-muted-foreground text-xs break-words">
          {row.original.supplier ?? EXPENSE_COPY.noSupplier}
        </span>
      </div>
    ),
  },
  {
    id: "category",
    header: H.category,
    meta: { className: COMPACT },
    cell: ({ row }) => (
      <ExpenseCategoryBadge
        category={row.original.category as ExpenseCategory}
      />
    ),
  },
  {
    id: "amount",
    header: () => <div className="text-right">{H.amount}</div>,
    meta: { className: COMPACT },
    cell: ({ row }) => (
      <div className={`${AMOUNT} font-medium`}>
        {formatDH(row.original.amountCents)}
      </div>
    ),
  },
  {
    id: "actions",
    meta: { className: COMPACT },
    header: () => <span className="sr-only">{EXPENSE_COPY.actionsLabel}</span>,
    cell: ({ row }) => <ExpenseActions expense={row.original} />,
  },
];
