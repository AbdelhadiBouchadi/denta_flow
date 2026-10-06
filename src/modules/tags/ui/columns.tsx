import type { ColumnDef } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/components/shared/data-table";
import TagBadge from "@/components/shared/tag-badge";
import { cn } from "@/lib/utils";
import {
  formatPatientCount,
  getTagIcon,
  TAG_COLUMN_HEADERS,
} from "../constants";
import type { TagListItem } from "../types";
import TagActions from "./tag-actions";

/** v9 puts the features generic first — `ColumnDef<TFeatures, TData>`. */
export const columns: ColumnDef<DataTableFeatures, TagListItem>[] = [
  {
    accessorKey: "label",
    header: TAG_COLUMN_HEADERS.tag,
    cell: ({ row }) => (
      <TagBadge
        label={row.original.label}
        color={row.original.color}
        icon={getTagIcon(row.original.icon)}
      />
    ),
  },
  {
    accessorKey: "patientCount",
    header: TAG_COLUMN_HEADERS.patientCount,
    cell: ({ row }) => (
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
    ),
  },
];

/** Appended by the view for admins only — a non-admin sees no actions. */
export const actionsColumn: ColumnDef<DataTableFeatures, TagListItem> = {
  id: "actions",
  header: () => <span className="sr-only">{TAG_COLUMN_HEADERS.actions}</span>,
  cell: ({ row }) => <TagActions tag={row.original} />,
};
