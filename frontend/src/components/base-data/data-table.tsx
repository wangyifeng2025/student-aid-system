"use client";

import * as React from "react";
import {
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
  useTable,
  type RowData,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** v9：按需注册能力。分页在后端，不注册 rowPaginationFeature。 */
const features = tableFeatures({
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
  /** 左侧固定列数。默认 1；认定 / 审核列表设为 2，把姓名一并钉住。 */
  pinStartCount?: number;
  /** 右侧固定列数。默认 1（操作列）；认定列表可设为 2，把「证明材料」一并钉住以免被挡住。 */
  pinEndCount?: number;
}

function parsePx(width: string | undefined, fallback: number): number {
  if (!width) return fallback;
  const n = Number.parseInt(width, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

type PinSide = "start" | "end" | false;

function pinSide(
  colIndex: number,
  colCount: number,
  pinStartCount: number,
  pinEndCount: number,
): PinSide {
  if (colCount < 2) return false;
  if (colIndex < pinStartCount) return "start";
  if (colIndex >= colCount - pinEndCount) return "end";
  return false;
}

function pinClass(pinned: PinSide, isHead: boolean, isInnerEdge: boolean): string {
  if (!pinned) return isHead ? "bg-surface" : "bg-inherit";
  return cn(
    "sticky",
    // 不透明底 + 高于中间列，避免后绘的单元格把左侧固定列盖住
    "bg-surface",
    !isHead && "group-hover:bg-brand-subtle",
    pinned === "start" && isInnerEdge && "shadow-[4px_0_8px_-6px_rgba(15,23,42,0.18)]",
    pinned === "end" && isInnerEdge && "shadow-[-4px_0_8px_-6px_rgba(15,23,42,0.18)]",
    pinned === "start" && (isHead ? "z-30" : "z-20"),
    pinned === "end" && (isHead ? "z-30" : "z-20"),
  );
}

/** 计算 sticky 列的 left/right 偏移，避免多列钉在同一侧时互相叠住。 */
function pinBox<T>(
  columns: Column<T>[],
  colIndex: number,
  pinned: PinSide,
  pinStartCount: number,
  pinEndCount: number,
): { style: React.CSSProperties; isInnerEdge: boolean } {
  if (pinned === "start") {
    const left = columns
      .slice(0, colIndex)
      .reduce((sum, col) => sum + parsePx(col.width, 96), 0);
    return { style: { left }, isInnerEdge: colIndex === pinStartCount - 1 };
  }
  if (pinned === "end") {
    const right = columns
      .slice(colIndex + 1)
      .reduce((sum, col) => sum + parsePx(col.width, 96), 0);
    const endStart = columns.length - pinEndCount;
    return { style: { right }, isInnerEdge: colIndex === endStart };
  }
  return { style: {}, isInnerEdge: false };
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
  pinStartCount = 1,
  pinEndCount = 1,
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

  const startN = React.useMemo(() => {
    const n = columns.length;
    if (n < 2) return 0;
    return Math.min(Math.max(pinStartCount, 1), n - 1);
  }, [columns.length, pinStartCount]);

  const endN = React.useMemo(() => {
    const n = columns.length;
    if (n < 2) return 0;
    return Math.min(Math.max(pinEndCount, 1), n - startN);
  }, [columns.length, pinEndCount, startN]);

  const table = useTable({
    features,
    data: data as RowData[],
    columns: columnDefs,
    getRowId: (row) => String(rowKey(row as T)),
  });

  const tableMinWidth = columns.reduce(
    (sum, col) => sum + parsePx(col.width, 96),
    0,
  );

  return (
    <div className="relative isolate min-w-0 w-full overflow-x-auto overflow-y-hidden rounded-md border border-line bg-surface">
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState label={error} onRetry={onRetry} />
      ) : data.length === 0 ? (
        <EmptyState label={emptyLabel} />
      ) : (
        <table
          className="caption-bottom text-sm"
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            tableLayout: "fixed",
            width: tableMinWidth,
            minWidth: "100%",
          }}
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header, colIndex) => {
                  const meta = header.column.columnDef.meta;
                  const pinned = pinSide(colIndex, columns.length, startN, endN);
                  const pin = pinBox(columns, colIndex, pinned, startN, endN);
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "text-[0.8125rem]",
                        !pinned && "overflow-hidden",
                        pinClass(pinned, true, pin.isInnerEdge),
                      )}
                      style={{
                        width: meta?.width,
                        minWidth: meta?.width ?? 96,
                        textAlign: meta?.align ?? "left",
                        borderBottom: "1px solid var(--color-border)",
                        ...pin.style,
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
                {row.getVisibleCells().map((cell, colIndex) => {
                  const meta = cell.column.columnDef.meta;
                  const pinned = pinSide(colIndex, columns.length, startN, endN);
                  const pin = pinBox(columns, colIndex, pinned, startN, endN);
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        !pinned && "overflow-hidden group-hover:bg-brand-subtle",
                        pinClass(pinned, false, pin.isInnerEdge),
                      )}
                      style={{
                        width: meta?.width,
                        minWidth: meta?.width ?? 96,
                        textAlign: meta?.align ?? "left",
                        borderBottom: "1px solid var(--color-border-light)",
                        ...pin.style,
                      }}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </table>
      )}
    </div>
  );
}
