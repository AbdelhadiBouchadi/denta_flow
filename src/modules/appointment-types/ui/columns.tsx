import type { ColumnDef } from "@tanstack/react-table";
import type { CSSProperties, ReactNode } from "react";

import type { DataTableFeatures } from "@/components/shared/data-table";
import StatusBadge from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import {
  APPOINTMENT_TYPE_COLUMN_HEADERS,
  APPOINTMENT_TYPE_STATUS_LABELS,
  formatDuration,
} from "../constants";
import type { AppointmentTypeListItem } from "../types";
import AppointmentTypeActions from "./appointment-type-actions";

/**
 * An inactive row reads as muted; the «Inactif» badge stays at full strength,
 * because it is the reason for the dimming (as in the «Actes» list).
 */
const Dimmed = ({
  row,
  className,
  children,
}: {
  row: AppointmentTypeListItem;
  className?: string;
  children: ReactNode;
}) => (
  <div className={cn(!row.isActive && "opacity-55", className)}>{children}</div>
);

/** v9 puts the features generic first — `ColumnDef<TFeatures, TData>`. */
export const columns: ColumnDef<DataTableFeatures, AppointmentTypeListItem>[] =
  [
    {
      accessorKey: "label",
      header: APPOINTMENT_TYPE_COLUMN_HEADERS.label,
      cell: ({ row }) => (
        <Dimmed row={row.original} className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            style={{ "--type-color": row.original.color } as CSSProperties}
            className="size-3 shrink-0 rounded-full bg-[var(--type-color)]"
          />
          <span className="text-foreground font-medium whitespace-normal">
            {row.original.label}
          </span>
        </Dimmed>
      ),
    },
    {
      accessorKey: "defaultDurationMinutes",
      header: APPOINTMENT_TYPE_COLUMN_HEADERS.duration,
      cell: ({ row }) => (
        <Dimmed row={row.original}>
          <span className="text-foreground-secondary tabular-nums">
            {formatDuration(row.original.defaultDurationMinutes)}
          </span>
        </Dimmed>
      ),
    },
    {
      accessorKey: "isActive",
      header: APPOINTMENT_TYPE_COLUMN_HEADERS.status,
      cell: ({ row }) =>
        row.original.isActive ? (
          <StatusBadge
            label={APPOINTMENT_TYPE_STATUS_LABELS.active}
            tone="success"
          />
        ) : (
          <StatusBadge
            label={APPOINTMENT_TYPE_STATUS_LABELS.inactive}
            tone="neutral"
          />
        ),
    },
  ];

/** Appended by the view for admins only — a non-admin sees no actions. */
export const actionsColumn: ColumnDef<
  DataTableFeatures,
  AppointmentTypeListItem
> = {
  id: "actions",
  header: () => (
    <span className="sr-only">{APPOINTMENT_TYPE_COLUMN_HEADERS.actions}</span>
  ),
  cell: ({ row }) => <AppointmentTypeActions type={row.original} />,
};
