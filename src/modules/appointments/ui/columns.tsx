import type { ColumnDef } from "@tanstack/react-table";
import type { CSSProperties } from "react";

import type { DataTableFeatures } from "@/components/shared/data-table";
import StatusBadge from "@/components/shared/status-badge";
import { formatTime } from "@/lib/format";
import { formatPatientName } from "@/modules/patients/derived";
import {
  APPOINTMENT_COLUMN_HEADERS as H,
  APPOINTMENT_COPY,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONES,
} from "../constants";
import { AppointmentStatus, type AppointmentListItem } from "../types";
import AppointmentActions from "./appointment-actions";

const Muted = ({ children }: { children: React.ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
);

/**
 * The paginated list of `/rendez-vous`. There is no date column: rows are
 * grouped under day header rows by the view, and each row keeps its times.
 * «Statut» sits before «Motif»: when the table is wider than its box, the
 * truncated free text is what scrolls out of view, not the status. «Motif»
 * is also the first column hidden on a narrow screen.
 *
 * Dates and times are read on the clinic's wall clock by the formatters. A
 * browser's bundled tz database can lag Node's around an offset change, so
 * the leaves suppress the hydration warning rather than freeze a string into
 * the payload — see the patients list for the same reasoning.
 *
 * v9 puts the features generic first — `ColumnDef<TFeatures, TData>`.
 */
export const columns: ColumnDef<DataTableFeatures, AppointmentListItem>[] = [
  {
    id: "time",
    header: H.time,
    cell: ({ row }) => (
      <span suppressHydrationWarning className="tabular-nums">
        {formatTime(row.original.startsAt)} – {formatTime(row.original.endsAt)}
      </span>
    ),
  },
  {
    id: "patient",
    header: H.patient,
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-xs tracking-wider">
          {row.original.patient.shortCode}
        </span>
        <span className="text-foreground font-medium">
          {formatPatientName(row.original.patient)}
        </span>
      </span>
    ),
  },
  {
    id: "practitioner",
    header: H.practitioner,
    cell: ({ row }) =>
      row.original.practitioner?.name ?? (
        <Muted>{APPOINTMENT_COPY.noPractitioner}</Muted>
      ),
  },
  {
    id: "type",
    header: H.type,
    cell: ({ row }) => {
      const { type } = row.original;
      if (!type) return <Muted>{APPOINTMENT_COPY.noType}</Muted>;
      return (
        <span className="flex items-center gap-2">
          {/* The colour is data — the palette value stored on the type. */}
          <span
            aria-hidden="true"
            style={{ "--type-color": type.color } as CSSProperties}
            className="size-3 shrink-0 rounded-full bg-[var(--type-color)]"
          />
          <span title={type.label} className="max-w-32 truncate">
            {type.label}
          </span>
        </span>
      );
    },
  },
  {
    id: "status",
    header: H.status,
    cell: ({ row }) => {
      const status = row.original.status as AppointmentStatus;
      return (
        <StatusBadge
          label={APPOINTMENT_STATUS_LABELS[status]}
          tone={APPOINTMENT_STATUS_TONES[status]}
        />
      );
    },
  },
  {
    id: "reason",
    header: H.reason,
    meta: { className: "hidden xl:table-cell" },
    cell: ({ row }) =>
      row.original.reason ? (
        // Truncated in place; the whole text stays one hover away.
        <span title={row.original.reason} className="block max-w-44 truncate">
          {row.original.reason}
        </span>
      ) : (
        <Muted>{APPOINTMENT_COPY.emptyField}</Muted>
      ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">{APPOINTMENT_COPY.actionsLabel}</span>,
    cell: ({ row }) => <AppointmentActions appointment={row.original} />,
  },
];
