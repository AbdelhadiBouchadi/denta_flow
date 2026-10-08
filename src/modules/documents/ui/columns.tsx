"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import type { DataTableFeatures } from "@/components/shared/data-table";
import { formatDate, formatTime } from "@/lib/format";
import { formatPatientName } from "@/modules/patients/derived";
import { DOCUMENT_COLUMN_HEADERS as H, DOCUMENT_COPY } from "../constants";
import type { DocumentListItem, DocumentType } from "../types";
import DocumentActions from "./document-actions";
import DocumentTypeBadge from "./document-type-badge";

const COMPACT = "px-2";
const WRAP = "px-2 whitespace-normal";

/**
 * The «Documents générés» list: Patient · Type · N° · Nom du fichier · Date ·
 * actions. No amount column — a document's figures live in its snapshot,
 * which a list never returns.
 */
export const columns: ColumnDef<DataTableFeatures, DocumentListItem>[] = [
  {
    id: "patient",
    header: H.patient,
    meta: { className: WRAP },
    cell: ({ row }) => (
      <Link
        href={`/patients/${row.original.patientId}?tab=documents`}
        className="flex max-w-48 flex-col items-start gap-0.5 hover:underline"
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
    id: "type",
    header: H.type,
    meta: { className: COMPACT },
    cell: ({ row }) => (
      <DocumentTypeBadge type={row.original.type as DocumentType} />
    ),
  },
  {
    id: "number",
    header: H.number,
    meta: { className: COMPACT },
    cell: ({ row }) => (
      <span className="font-mono text-sm whitespace-nowrap tabular-nums">
        {row.original.number ?? DOCUMENT_COPY.noNumber}
      </span>
    ),
  },
  {
    id: "fileName",
    header: H.fileName,
    meta: { className: WRAP },
    cell: ({ row }) => (
      <span className="text-muted-foreground block max-w-80 text-sm break-all">
        {row.original.fileName}
      </span>
    ),
  },
  {
    id: "date",
    header: H.date,
    meta: { className: COMPACT },
    cell: ({ row }) => (
      // Clinic wall clock, rendered on the server and in a browser that may
      // sit in another zone — the text is the same, the warning is not.
      <div suppressHydrationWarning className="flex flex-col tabular-nums">
        <span className="whitespace-nowrap">
          {formatDate(row.original.createdAt)}
        </span>
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {formatTime(row.original.createdAt)}
        </span>
      </div>
    ),
  },
  {
    id: "actions",
    meta: { className: COMPACT },
    header: () => <span className="sr-only">{DOCUMENT_COPY.actionsLabel}</span>,
    cell: ({ row }) => (
      <DocumentActions document={row.original} showDossierLink />
    ),
  },
];
