"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { InfoIcon } from "lucide-react";
import Link from "next/link";

import BalanceAmount from "@/components/shared/balance-amount";
import type { DataTableFeatures } from "@/components/shared/data-table";
import StatusBadge from "@/components/shared/status-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDate, formatDH } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatPatientName } from "@/modules/patients/derived";
import {
  TREATMENT_COLUMN_HEADERS as H,
  TREATMENT_COPY,
  TREATMENT_STATUS_LABELS,
  TREATMENT_STATUS_TONES,
} from "../constants";
import { TreatmentStatus, type TreatmentListItem } from "../types";
import { TeethCell } from "./teeth-cell";
import TreatmentActions from "./treatment-actions";
import { TreatmentLabel } from "./treatment-label";

const isCanceled = (treatment: TreatmentListItem) =>
  treatment.status === TreatmentStatus.Canceled;

/** A cancelled acte stays in the list, muted: it is history, never owed. */
const Muted = ({
  treatment,
  className,
  children,
}: {
  treatment: TreatmentListItem;
  className?: string;
  children: React.ReactNode;
}) => (
  <div
    className={cn(isCanceled(treatment) && "text-muted-foreground", className)}
  >
    {children}
  </div>
);

/** `tabular-nums` is mandatory: amounts stack in a column (06-ui.md §2). */
const AMOUNT = "text-right tabular-nums whitespace-nowrap";

/**
 * Width budget (prompts/19-actes.md, follow-up §1). shadcn's TableCell is
 * `whitespace-nowrap`, which kept the NGAP wording on one line and pushed the
 * table ~640 px past the content area. Text columns wrap here, every column
 * pads `px-2` instead of the DataTable's `p-4`, and the practitioner shows
 * only from `2xl` — so Montant · Statut · Reste fit from 1280 px, sidebar
 * expanded. `meta.className` lands on the header and every cell alike.
 */
const COMPACT = "px-2";
const WRAP = "px-2 whitespace-normal";

/**
 * There is no reference screen for `/actes`: the columns follow
 * prompts/19-actes.md — Date · Patient · Acte · Dents · Praticien · Montant ·
 * Statut · Reste.
 */
export const columns: ColumnDef<DataTableFeatures, TreatmentListItem>[] = [
  {
    id: "date",
    header: H.date,
    meta: { className: COMPACT },
    cell: ({ row }) => (
      <Muted treatment={row.original}>
        {/* Clinic wall clock; see the patients columns on the warning. */}
        <span suppressHydrationWarning className="tabular-nums">
          {formatDate(row.original.listedAt)}
        </span>
      </Muted>
    ),
  },
  {
    id: "patient",
    header: H.patient,
    meta: { className: WRAP },
    cell: ({ row }) => (
      // Stacked — the short code above the name — so the column is as wide
      // as the name, which wraps past 9rem.
      <Link
        href={`/patients/${row.original.patientId}?tab=treatments`}
        className="flex max-w-36 flex-col items-start gap-0.5 hover:underline"
      >
        <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-xs tracking-wider">
          {row.original.patient.shortCode}
        </span>
        <span
          className={cn(
            "leading-snug",
            isCanceled(row.original) && "text-muted-foreground",
          )}
        >
          {formatPatientName(row.original.patient)}
        </span>
      </Link>
    ),
  },
  {
    id: "label",
    header: H.label,
    meta: { className: WRAP },
    cell: ({ row }) => (
      <div className="max-w-[26rem] min-w-40">
        <TreatmentLabel
          treatment={row.original}
          struck={isCanceled(row.original)}
        />
      </div>
    ),
  },
  {
    id: "teeth",
    header: H.teeth,
    meta: { className: WRAP },
    cell: ({ row }) => (
      <Muted treatment={row.original} className="max-w-32 min-w-16">
        <TeethCell teeth={row.original.teeth} />
      </Muted>
    ),
  },
  {
    id: "practitioner",
    header: H.practitioner,
    // The practitioner filter stays in the header at every width.
    meta: { className: cn(WRAP, "hidden 2xl:table-cell") },
    cell: ({ row }) => (
      <Muted treatment={row.original} className="max-w-36">
        {row.original.practitioner?.name ?? (
          <span className="text-muted-foreground">
            {TREATMENT_COPY.noPractitioner}
          </span>
        )}
      </Muted>
    ),
  },
  {
    id: "amount",
    header: () => <div className="text-right">{H.amount}</div>,
    meta: { className: COMPACT },
    cell: ({ row }) => (
      <Muted
        treatment={row.original}
        className={cn(AMOUNT, isCanceled(row.original) && "line-through")}
      >
        {formatDH(row.original.totalAmountCents)}
      </Muted>
    ),
  },
  {
    id: "status",
    header: H.status,
    meta: { className: COMPACT },
    cell: ({ row }) => {
      const status = row.original.status as TreatmentStatus;
      return (
        <StatusBadge
          label={TREATMENT_STATUS_LABELS[status]}
          tone={TREATMENT_STATUS_TONES[status]}
        />
      );
    },
  },
  {
    id: "remaining",
    meta: { className: COMPACT },
    header: () => (
      <div className="flex items-center justify-end gap-1">
        {H.remaining}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={TREATMENT_COPY.remainingTooltip}
                className="text-muted-foreground hover:text-foreground"
              />
            }
          >
            <InfoIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>{TREATMENT_COPY.remainingTooltip}</TooltipContent>
        </Tooltip>
      </div>
    ),
    cell: ({ row }) => (
      // Derived in SQL from the payments allocated to this acte; never
      // computed here, never clamped (08-clinical.md §3).
      // A planned or cancelled acte with payments allocated to it reads
      // «Avance», never a negative amount.
      <Muted treatment={row.original} className={AMOUNT}>
        <BalanceAmount
          remainingCents={row.original.remainingCents}
          showCreditLabel
          className="font-normal"
        />
      </Muted>
    ),
  },
  {
    id: "actions",
    meta: { className: COMPACT },
    header: () => <span className="sr-only">{TREATMENT_COPY.actionsLabel}</span>,
    cell: ({ row }) => (
      <TreatmentActions treatment={row.original} showDossierLink />
    ),
  },
];
