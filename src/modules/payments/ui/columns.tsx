"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import type { DataTableFeatures } from "@/components/shared/data-table";
import { formatDate, formatDH, formatTime } from "@/lib/format";
import { formatPatientName } from "@/modules/patients/derived";
import {
  PAYMENT_COLUMN_HEADERS as H,
  PAYMENT_COPY,
  PAYMENT_METHOD_LABELS,
} from "../constants";
import type { PaymentListItem, PaymentMethod } from "../types";
import PaymentActions from "./payment-actions";

/** `tabular-nums` is mandatory: amounts stack in a column (06-ui.md §2). */
const AMOUNT = "text-right tabular-nums whitespace-nowrap";

/** Text columns wrap and pad `px-2`, as on `/actes`, so the table fits. */
const COMPACT = "px-2";
const WRAP = "px-2 whitespace-normal";

const Empty = ({ children }: { children: React.ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
);

/**
 * There is no reference screen for `/paiements`: the columns follow
 * prompts/20-paiements.md — Date · Patient · Mode · Acte · Référence ·
 * Assurance · Montant · actions.
 */
export const columns: ColumnDef<DataTableFeatures, PaymentListItem>[] = [
  {
    id: "date",
    header: H.date,
    meta: { className: COMPACT },
    cell: ({ row }) => (
      // Clinic wall clock, rendered on the server and in a browser that may
      // sit in another zone — the text is the same, the warning is not.
      <div suppressHydrationWarning className="flex flex-col tabular-nums">
        <span className="whitespace-nowrap">
          {formatDate(row.original.paidAt)}
        </span>
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {formatTime(row.original.paidAt)}
        </span>
      </div>
    ),
  },
  {
    id: "patient",
    header: H.patient,
    meta: { className: WRAP },
    cell: ({ row }) => (
      <Link
        href={`/patients/${row.original.patientId}?tab=payments`}
        className="flex max-w-40 flex-col items-start gap-0.5 hover:underline"
      >
        <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-xs tracking-wider">
          {row.original.patient.shortCode}
        </span>
        <span className="leading-snug">
          {formatPatientName(row.original.patient)}
        </span>
      </Link>
    ),
  },
  {
    id: "method",
    header: H.method,
    meta: { className: COMPACT },
    cell: ({ row }) =>
      PAYMENT_METHOD_LABELS[row.original.method as PaymentMethod],
  },
  {
    id: "treatment",
    header: H.treatment,
    meta: { className: WRAP },
    cell: ({ row }) => (
      <div className="max-w-64 min-w-28">
        {row.original.treatment?.label ?? (
          <Empty>{PAYMENT_COPY.noTreatment}</Empty>
        )}
      </div>
    ),
  },
  {
    id: "reference",
    header: H.reference,
    meta: { className: WRAP },
    cell: ({ row }) => (
      <div className="max-w-40 break-words">
        {row.original.reference ?? <Empty>{PAYMENT_COPY.noReference}</Empty>}
      </div>
    ),
  },
  {
    id: "insurer",
    header: H.insurer,
    meta: { className: WRAP },
    cell: ({ row }) =>
      row.original.insurer?.name ?? <Empty>{PAYMENT_COPY.noInsurer}</Empty>,
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
    header: () => <span className="sr-only">{PAYMENT_COPY.actionsLabel}</span>,
    cell: ({ row }) => <PaymentActions payment={row.original} showDossierLink />,
  },
];
