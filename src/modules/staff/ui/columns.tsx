import type { ColumnDef } from "@tanstack/react-table";
import type { CSSProperties, ReactNode } from "react";

import type { DataTableFeatures } from "@/components/shared/data-table";
import StatusBadge from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import {
  EMPTY_FIELD,
  STAFF_COLUMN_HEADERS,
  STAFF_ROLE_LABELS,
  STAFF_ROLE_TONES,
  STAFF_STATUS_LABELS,
} from "../constants";
import type { StaffListItem } from "../types";
import StaffActions from "./staff-actions";

/**
 * An inactive row reads as muted. The shared DataTable has no row-level class,
 * so each cell dims its own content; the «Inactif» badge stays at full
 * strength, because it is the reason for the dimming.
 */
const Dimmed = ({
  row,
  children,
}: {
  row: StaffListItem;
  children: ReactNode;
}) => <div className={cn(!row.isActive && "opacity-55")}>{children}</div>;

const Optional = ({ value }: { value: string | null }) =>
  value ? (
    <span className="text-foreground-secondary">{value}</span>
  ) : (
    <span className="text-muted-foreground">{EMPTY_FIELD}</span>
  );

/** The person's initial on their own agenda colour — data, not a token. */
const StaffInitial = ({ staff }: { staff: StaffListItem }) => (
  <span
    aria-hidden="true"
    style={{ "--staff-color": staff.color } as CSSProperties}
    className="font-heading flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--staff-color)_16%,transparent)] text-sm font-semibold text-[var(--staff-color)]"
  >
    {staff.name.trim().charAt(0).toUpperCase() || EMPTY_FIELD}
  </span>
);

/** v9 puts the features generic first — `ColumnDef<TFeatures, TData>`. */
export const columns: ColumnDef<DataTableFeatures, StaffListItem>[] = [
  {
    accessorKey: "name",
    header: STAFF_COLUMN_HEADERS.name,
    cell: ({ row }) => (
      <Dimmed row={row.original}>
        <span className="flex items-center gap-2.5">
          <StaffInitial staff={row.original} />
          <span className="flex min-w-0 flex-col">
            <span className="text-foreground truncate font-medium">
              {row.original.name}
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {row.original.email}
            </span>
          </span>
        </span>
      </Dimmed>
    ),
  },
  {
    accessorKey: "role",
    header: STAFF_COLUMN_HEADERS.role,
    cell: ({ row }) => (
      <Dimmed row={row.original}>
        <StatusBadge
          label={STAFF_ROLE_LABELS[row.original.role]}
          tone={STAFF_ROLE_TONES[row.original.role]}
        />
      </Dimmed>
    ),
  },
  {
    accessorKey: "title",
    header: STAFF_COLUMN_HEADERS.title,
    cell: ({ row }) => (
      <Dimmed row={row.original}>
        <Optional value={row.original.title} />
      </Dimmed>
    ),
  },
  {
    accessorKey: "inpe",
    header: STAFF_COLUMN_HEADERS.inpe,
    cell: ({ row }) => (
      <Dimmed row={row.original}>
        <span className="tabular-nums">
          <Optional value={row.original.inpe} />
        </span>
      </Dimmed>
    ),
  },
  {
    accessorKey: "isActive",
    header: STAFF_COLUMN_HEADERS.status,
    cell: ({ row }) =>
      row.original.isActive ? (
        <StatusBadge label={STAFF_STATUS_LABELS.active} tone="success" />
      ) : (
        <StatusBadge label={STAFF_STATUS_LABELS.inactive} tone="neutral" />
      ),
  },
];

/** Appended by the view for admins only — a non-admin sees no actions. */
export const actionsColumn: ColumnDef<DataTableFeatures, StaffListItem> = {
  id: "actions",
  header: () => <span className="sr-only">{STAFF_COLUMN_HEADERS.actions}</span>,
  cell: ({ row }) => <StaffActions staff={row.original} />,
};
