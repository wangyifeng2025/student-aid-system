import * as React from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

export interface Column<T> {
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
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

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading,
  error,
  onRetry,
  emptyLabel,
}: DataTableProps<T>) {
  return (
    <div
      style={{
        backgroundColor: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
      }}
    >
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState label={error} onRetry={onRetry} />
      ) : data.length === 0 ? (
        <EmptyState label={emptyLabel} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {columns.map((col, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 font-medium whitespace-nowrap"
                    style={{
                      color: "var(--color-text-secondary)",
                      fontSize: "0.8125rem",
                      width: col.width,
                      textAlign: col.align ?? "left",
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="transition-colors"
                  style={{ borderBottom: "1px solid var(--color-border-light)" }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--color-primary-subtle)")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  {columns.map((col, i) => (
                    <td
                      key={i}
                      className="px-4 py-3"
                      style={{
                        color: "var(--color-text-secondary)",
                        textAlign: col.align ?? "left",
                      }}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
