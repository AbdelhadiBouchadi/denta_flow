import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

import type { DataTableFeatures } from "@/components/shared/data-table";
import StatusBadge from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import {
  formatPatientCount,
  INSURER_COLUMN_HEADERS,
  INSURER_STATUS_LABELS,
} from "../constants";
import type { InsurerListItem } from "../types";
import InsurerActions from "./insurer-actions";

/**
 * An inactive row reads as muted. The shared DataTable has no row-level class,
 * so each cell dims its own content; the «Inactif» badge stays at full
 * strength, because it is the reason for the dimming.
 */
const Dimmed = ({
  row,
  children,
}: {
  row: InsurerListItem;
  children: ReactNode;
}) => <div className={cn(!row.isActive && "opacity-55")}>{children}</div>;

/** v9 puts the features generic first — `ColumnDef<TFeatures, TData>`. */
export const columns: ColumnDef<DataTableFeatures, InsurerListItem>[] = [
  {
    accessorKey: "name",
    header: INSURER_COLUMN_HEADERS.name,
    cell: ({ row }) => (
      <Dimmed row={row.original}>
        <span className="text-foreground font-medium">{row.original.name}</span>
      </Dimmed>
    ),
  },
  {
    accessorKey: "isActive",
    header: INSURER_COLUMN_HEADERS.status,
    cell: ({ row }) =>
      row.original.isActive ? (
        <StatusBadge label={INSURER_STATUS_LABELS.active} tone="success" />
      ) : (
        <StatusBadge label={INSURER_STATUS_LABELS.inactive} tone="neutral" />
      ),
  },
  {
    accessorKey: "patientCount",
    header: INSURER_COLUMN_HEADERS.patientCount,
    cell: ({ row }) => (
      <Dimmed row={row.original}>
        <span
          className={cn(
            "tabular-nums",
            row.original.patientCount === 0
              ? "text-muted-foreground"
              : "text-foreground-secondary",
          )}
        >
          {formatPatientCount(row.original.patientCount)}
        </span>
      </Dimmed>
    ),
  },
];

/** Appended by the view for admins only — a non-admin sees no actions. */
export const actionsColumn: ColumnDef<DataTableFeatures, InsurerListItem> = {
  id: "actions",
  header: () => (
    <span className="sr-only">{INSURER_COLUMN_HEADERS.actions}</span>
  ),
  cell: ({ row }) => <InsurerActions insurer={row.original} />,
};
