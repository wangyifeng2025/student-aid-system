"use client";

import * as React from "react";
import {
  columnPinningFeature,
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
  useTable,
  type RowData,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** v9：按需注册能力。分页在后端，不注册 rowPaginationFeature。 */
const features = tableFeatures({
  columnPinningFeature,
  columnVisibilityFeature,
  columnMeta: {} as {
    align: "left" | "right" | "center";
    width?: string;
  },
});

type DataTableFeatures = typeof features;

const columnHelper = createColumnHelper<DataTableFeatures, RowData>();

export interface Column<T> {
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** 列的建议宽度（作为最小宽度；列少时仍会铺满容器） */
  width?: string;
  align?: "left" | "right" | "center";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => React.Key;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyLabel?: string;
}

function parsePx(width: string | undefined, fallback: number): number {
  if (!width) return fallback;
  const n = Number.parseInt(width, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function pinClass(
  pinned: "start" | "end" | false,
  isHead: boolean,
): string {
  if (!pinned) return "bg-surface";
  return cn(
    "sticky bg-surface",
    pinned === "start" && "left-0 shadow-[4px_0_8px_-6px_rgba(15,23,42,0.18)]",
    pinned === "end" && "right-0 shadow-[-4px_0_8px_-6px_rgba(15,23,42,0.18)]",
    isHead ? "z-[4]" : "z-[2]",
  );
}

/** 单元格内单行省略，悬停可看全文。 */
export function CellText({
  children,
  title,
  className,
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  const hint = title ?? (typeof children === "string" ? children : undefined);
  return (
    <span className={cn("block truncate", className)} title={hint || undefined}>
      {children}
    </span>
  );
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading,
  error,
  onRetry,
  emptyLabel,
}: DataTableProps<T>) {
  const columnDefs = React.useMemo(
    () =>
      columnHelper.columns(
        columns.map((col, index) =>
          columnHelper.display({
            id: `col-${index}`,
            header: () => col.header,
            cell: ({ row }) => col.cell(row.original as T),
            meta: {
              align: col.align ?? "left",
              width: col.width,
            },
          }),
        ),
      ),
    [columns],
  );

  const columnPinning = React.useMemo(() => {
    const firstId = columnDefs[0]?.id;
    const lastId = columnDefs[columnDefs.length - 1]?.id;
    if (!firstId || !lastId || firstId === lastId) {
      return { start: [] as string[], end: [] as string[] };
    }
    return { start: [firstId], end: [lastId] };
  }, [columnDefs]);

  const table = useTable({
    features,
    data: data as RowData[],
    columns: columnDefs,
    getRowId: (row) => String(rowKey(row as T)),
    state: { columnPinning },
  });

  const tableMinWidth = columns.reduce(
    (sum, col) => sum + parsePx(col.width, 96),
    0,
  );

  return (
    <div className="min-w-0 w-full overflow-hidden rounded-md border border-line bg-surface">
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState label={error} onRetry={onRetry} />
      ) : data.length === 0 ? (
        <EmptyState label={emptyLabel} />
      ) : (
        <Table
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            tableLayout: "fixed",
            minWidth: tableMinWidth,
          }}
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const pinned = header.column.getIsPinned();
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "overflow-hidden text-[0.8125rem]",
                        pinClass(pinned, true),
                      )}
                      style={{
                        width: meta?.width,
                        minWidth: meta?.width ?? 96,
                        textAlign: meta?.align ?? "left",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="group hover:bg-transparent">
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  const pinned = cell.column.getIsPinned();
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "overflow-hidden group-hover:bg-brand-subtle",
                        pinClass(pinned, false),
                      )}
                      style={{
                        width: meta?.width,
                        minWidth: meta?.width ?? 96,
                        textAlign: meta?.align ?? "left",
                        borderBottom: "1px solid var(--color-border-light)",
                      }}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
