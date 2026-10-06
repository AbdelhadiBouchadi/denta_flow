"use client";

import {
  flexRender,
  metaHelper,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { Fragment, type ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * What a column may declare in `meta`. `className` lands on both the header
 * and every cell of the column — the way a column is hidden below a
 * breakpoint (`hidden xl:table-cell`) without the header and cells drifting.
 */
interface DataTableColumnMeta {
  className?: string;
}

// v9 registers features explicitly. The core row model is automatic; add a
// feature here only when a slice actually needs sorting, filtering or selection.
const features = tableFeatures({
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

/** Slices type their `columns` export as ColumnDef<DataTableFeatures, TData>[]. */
export type DataTableFeatures = typeof features;

/** A full-width header row drawn above the first row of each group. */
export interface DataTableRowGroup {
  key: string;
  header: ReactNode;
}

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<DataTableFeatures, TData>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
  /**
   * Groups consecutive rows under a header row (the appointments list's day
   * headers). Rows must already arrive in group order; a header is drawn
   * whenever the key changes from the row above.
   */
  getRowGroup?: (row: TData) => DataTableRowGroup;
}

/**
 * The one table. It scrolls horizontally INSIDE its own border and never
 * widens the page: `min-w-0` lets it shrink inside any flex column, and the
 * overflow is its own. Fixed here once, not per slice.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  onRowClick,
  getRowGroup,
}: DataTableProps<TData>) {
  const table = useTable({ features, columns, data });
  const rows = table.getRowModel().rows;

  return (
    <div className="bg-background max-w-full min-w-0 overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={header.column.columnDef.meta?.className}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row, index) => {
              const group = getRowGroup?.(row.original);
              const previous =
                group && index > 0
                  ? getRowGroup?.(rows[index - 1].original)
                  : undefined;
              const startsGroup = group && group.key !== previous?.key;

              return (
                <Fragment key={row.id}>
                  {startsGroup && (
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell
                        // Every column, hidden ones included: a colSpan
                        // larger than the visible count is harmless.
                        colSpan={columns.length}
                        className="text-foreground px-4 py-2 text-sm font-semibold"
                      >
                        {group.header}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow onClick={() => onRowClick?.(row.original)}>
                    {row.getAllCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "cursor-pointer p-4 text-sm",
                          cell.column.columnDef.meta?.className,
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </Fragment>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-muted-foreground h-19 text-center"
              >
                Aucun résultat.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
