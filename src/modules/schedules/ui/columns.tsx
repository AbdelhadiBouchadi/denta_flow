import type { ColumnDef } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/components/shared/data-table";
import StatusBadge from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import {
  EXCEPTION_COLUMN_HEADERS,
  EXCEPTION_COPY,
  formatExceptionPeriod,
} from "../constants";
import type { ScheduleExceptionListItem } from "../types";
import ExceptionActions from "./exception-actions";

/** The «Congés et fermetures» list. v9: `ColumnDef<TFeatures, TData>`. */
export const columns: ColumnDef<
  DataTableFeatures,
  ScheduleExceptionListItem
>[] = [
  {
    id: "period",
    header: EXCEPTION_COLUMN_HEADERS.period,
    cell: ({ row }) => (
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          row.original.isPast && "opacity-55",
        )}
      >
        <span className="text-foreground font-medium tabular-nums">
          {formatExceptionPeriod(row.original.period)}
        </span>
        {row.original.isPast && (
          <StatusBadge label={EXCEPTION_COPY.past} tone="neutral" />
        )}
      </div>
    ),
  },
  {
    id: "scope",
    header: EXCEPTION_COLUMN_HEADERS.scope,
    cell: ({ row }) =>
      row.original.practitionerId ? (
        <span className="text-foreground-secondary">
          {row.original.practitionerName}
        </span>
      ) : (
        <StatusBadge label={EXCEPTION_COPY.clinicWide} tone="brand" />
      ),
  },
  {
    accessorKey: "reason",
    header: EXCEPTION_COLUMN_HEADERS.reason,
    cell: ({ row }) => (
      <span
        className={cn(
          "whitespace-normal",
          row.original.reason
            ? "text-foreground-secondary"
            : "text-muted-foreground",
        )}
      >
        {row.original.reason ?? EXCEPTION_COPY.noReason}
      </span>
    ),
  },
];

/** Appended by the view for admins only — a non-admin sees no actions. */
export const actionsColumn: ColumnDef<
  DataTableFeatures,
  ScheduleExceptionListItem
> = {
  id: "actions",
  header: () => (
    <span className="sr-only">{EXCEPTION_COLUMN_HEADERS.actions}</span>
  ),
  cell: ({ row }) => <ExceptionActions exception={row.original} />,
};
