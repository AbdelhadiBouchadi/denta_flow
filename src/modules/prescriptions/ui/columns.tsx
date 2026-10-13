"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/components/shared/data-table";
import StatusBadge from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import {
  MEDICATION_ACTIVE_BADGE,
  MEDICATION_COLUMN_HEADERS as H,
  PRESCRIPTION_COPY as COPY,
} from "../constants";
import type { MedicationListItem } from "../types";
import MedicationActions from "./medication-actions";

const dimmed = (row: MedicationListItem) => cn(!row.isActive && "opacity-55");

/** The «Médicaments» table: name and strength · form · defaults · status. */
export const columns: ColumnDef<DataTableFeatures, MedicationListItem>[] = [
  {
    id: "name",
    header: H.name,
    meta: { className: "px-2 whitespace-normal" },
    cell: ({ row }) => (
      <div className={cn("flex max-w-64 flex-col", dimmed(row.original))}>
        <span className="text-foreground font-medium">
          {row.original.name}
        </span>
        {row.original.strength && (
          <span className="text-muted-foreground text-xs">
            {row.original.strength}
          </span>
        )}
      </div>
    ),
  },
  {
    id: "form",
    header: H.form,
    meta: { className: "px-2" },
    cell: ({ row }) => (
      <span className={cn("text-foreground-secondary", dimmed(row.original))}>
        {row.original.form}
      </span>
    ),
  },
  {
    id: "defaults",
    header: H.defaults,
    meta: { className: "px-2 whitespace-normal" },
    cell: ({ row }) => (
      <div className={cn("flex max-w-72 flex-col text-sm", dimmed(row.original))}>
        <span>{row.original.defaultPosology ?? COPY.noValue}</span>
        {row.original.defaultDuration && (
          <span className="text-muted-foreground text-xs">
            {row.original.defaultDuration}
          </span>
        )}
      </div>
    ),
  },
  {
    id: "status",
    header: H.status,
    meta: { className: "px-2" },
    cell: ({ row }) => {
      const badge =
        MEDICATION_ACTIVE_BADGE[row.original.isActive ? "active" : "inactive"];
      return <StatusBadge label={badge.label} tone={badge.tone} />;
    },
  },
];

/** Appended by the view for admins and dentists only. */
export const actionsColumn: ColumnDef<DataTableFeatures, MedicationListItem> = {
  id: "actions",
  meta: { className: "px-2" },
  header: () => <span className="sr-only">{H.actions}</span>,
  cell: ({ row }) => <MedicationActions medication={row.original} />,
};
