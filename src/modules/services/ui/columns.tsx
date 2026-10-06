import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

import type { DataTableFeatures } from "@/components/shared/data-table";
import StatusBadge from "@/components/shared/status-badge";
import { formatDH } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  SERVICE_CATEGORY_LABELS,
  SERVICE_CATEGORY_TONE,
  SERVICE_COLUMN_HEADERS,
  SERVICE_STATUS_LABELS,
} from "../constants";
import type { ServiceListItem } from "../types";
import { NgapReference } from "./ngap-reference";
import ServiceActions from "./service-actions";

const EMPTY_CODE = "—";

/**
 * An inactive row reads as muted. The shared DataTable has no row-level class,
 * so each cell dims its own content; the «Inactif» badge stays at full
 * strength, because it is the reason for the dimming.
 */
const Dimmed = ({
  row,
  className,
  children,
}: {
  row: ServiceListItem;
  className?: string;
  children: ReactNode;
}) => (
  <div className={cn(!row.isActive && "opacity-55", className)}>{children}</div>
);

/** v9 puts the features generic first — `ColumnDef<TFeatures, TData>`. */
export const columns: ColumnDef<DataTableFeatures, ServiceListItem>[] = [
  {
    accessorKey: "label",
    header: SERVICE_COLUMN_HEADERS.label,
    cell: ({ row }) => (
      <Dimmed row={row.original} className="flex max-w-md flex-col gap-0.5">
        <span className="text-foreground font-medium whitespace-normal">
          {row.original.label}
        </span>
        {row.original.ngap && <NgapReference {...row.original.ngap} />}
      </Dimmed>
    ),
  },
  {
    accessorKey: "category",
    header: SERVICE_COLUMN_HEADERS.category,
    cell: ({ row }) => (
      <Dimmed row={row.original}>
        <StatusBadge
          label={SERVICE_CATEGORY_LABELS[row.original.category]}
          tone={SERVICE_CATEGORY_TONE}
        />
      </Dimmed>
    ),
  },
  {
    accessorKey: "nomenclatureCode",
    header: SERVICE_COLUMN_HEADERS.code,
    cell: ({ row }) => (
      <Dimmed row={row.original}>
        {row.original.nomenclatureCode ? (
          <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-xs tracking-wider">
            {row.original.nomenclatureCode}
          </span>
        ) : (
          <span className="text-muted-foreground">{EMPTY_CODE}</span>
        )}
      </Dimmed>
    ),
  },
  {
    accessorKey: "defaultPriceCents",
    header: () => (
      <div className="text-right">{SERVICE_COLUMN_HEADERS.price}</div>
    ),
    cell: ({ row }) => (
      <Dimmed row={row.original} className="text-right">
        <span className="text-foreground font-medium tabular-nums">
          {formatDH(row.original.defaultPriceCents)}
        </span>
      </Dimmed>
    ),
  },
  {
    accessorKey: "durationMinutes",
    header: SERVICE_COLUMN_HEADERS.duration,
    cell: ({ row }) => (
      <Dimmed row={row.original}>
        <span className="text-foreground-secondary tabular-nums">
          {formatDuration(row.original.durationMinutes)}
        </span>
      </Dimmed>
    ),
  },
  {
    accessorKey: "isActive",
    header: SERVICE_COLUMN_HEADERS.status,
    cell: ({ row }) =>
      row.original.isActive ? (
        <StatusBadge label={SERVICE_STATUS_LABELS.active} tone="success" />
      ) : (
        <StatusBadge label={SERVICE_STATUS_LABELS.inactive} tone="neutral" />
      ),
  },
];

/** Appended by the view for admins only — a non-admin sees no actions. */
export const actionsColumn: ColumnDef<DataTableFeatures, ServiceListItem> = {
  id: "actions",
  header: () => (
    <span className="sr-only">{SERVICE_COLUMN_HEADERS.actions}</span>
  ),
  cell: ({ row }) => <ServiceActions service={row.original} />,
};
