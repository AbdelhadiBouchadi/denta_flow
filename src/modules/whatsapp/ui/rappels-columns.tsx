"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import type { DataTableFeatures } from "@/components/shared/data-table";
import StatusBadge from "@/components/shared/status-badge";
import { formatTime } from "@/lib/format";
import { EVENT_LABELS, EVENT_TONES, WHATSAPP_COPY as COPY } from "../constants";
import type { WhatsappDayRow } from "../types";
import { MessageStatusBadge } from "./message-status-badge";
import { RappelActions } from "./rappel-actions";

/** «Envoyé à»: the send, or the manual opening; the delivery time beside it. */
const sentCell = (row: WhatsappDayRow) => {
  if (!row.sentAt) return <span className="text-muted-foreground">—</span>;
  return <span className="tabular-nums">{formatTime(row.sentAt)}</span>;
};

/**
 * The day's table. `actions` follows the mode: a to-do list in manual mode,
 * a monitoring list otherwise (prompts/33b, decision 1).
 */
export const getColumns = (
  actions: "work" | "rescue",
): ColumnDef<DataTableFeatures, WhatsappDayRow>[] => [
  {
    id: "time",
    header: COPY.colTime,
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {formatTime(row.original.startsAt)}
      </span>
    ),
  },
  {
    id: "patient",
    header: COPY.colPatient,
    cell: ({ row }) => (
      <Link
        href={`/patients/${row.original.patient.id}`}
        className="text-foreground font-medium underline-offset-4 hover:underline"
      >
        {row.original.patient.name}
      </Link>
    ),
  },
  {
    id: "phone",
    header: COPY.colPhone,
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {row.original.phoneMasked}
      </span>
    ),
    meta: { className: "hidden md:table-cell" },
  },
  {
    id: "practitioner",
    header: COPY.colPractitioner,
    cell: ({ row }) => row.original.practitioner ?? COPY.noPractitioner,
    meta: { className: "hidden xl:table-cell" },
  },
  {
    id: "event",
    header: COPY.colEvent,
    cell: ({ row }) =>
      row.original.event ? (
        <StatusBadge
          label={EVENT_LABELS[row.original.event]}
          tone={EVENT_TONES[row.original.event]}
        />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    meta: { className: "hidden sm:table-cell" },
  },
  {
    id: "status",
    header: COPY.colStatus,
    cell: ({ row }) => (
      <MessageStatusBadge
        status={row.original.status}
        skipReason={row.original.skipReason}
        unscheduledReason={row.original.unscheduledReason}
        errorCode={row.original.errorCode}
      />
    ),
  },
  {
    id: "sentAt",
    header: COPY.colSentAt,
    cell: ({ row }) => sentCell(row.original),
    meta: { className: "hidden lg:table-cell" },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">{COPY.colActions}</span>,
    cell: ({ row }) => <RappelActions row={row.original} variant={actions} />,
    meta: { className: "text-right" },
  },
];
