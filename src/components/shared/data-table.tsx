"use client";

import {
  flexRender,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// v9 registers features explicitly. The core row model is automatic; add a
// feature here only when a slice actually needs sorting, filtering or selection.
const features = tableFeatures({});

/** Slices type their `columns` export as ColumnDef<DataTableFeatures, TData>[]. */
export type DataTableFeatures = typeof features;

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<DataTableFeatures, TData>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  onRowClick,
}: DataTableProps<TData>) {
  const table = useTable({ features, columns, data });

  return (
    <div className="bg-background overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
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
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} onClick={() => onRowClick?.(row.original)}>
                {row.getAllCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="cursor-pointer p-4 text-sm"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
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
