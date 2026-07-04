"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

// 列表底部分页条：展示区间统计 + 上下页切换 + 每页条数选择。
export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const btn =
    "inline-flex h-8 items-center gap-1 rounded-sm border border-line bg-surface px-2.5 text-sm text-ink-soft transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-mute">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          共 {total} 条，第 {page}/{totalPages} 页（{from}–{to}）
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs">
            <span>每页</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded-sm border border-line bg-surface px-1.5 text-sm text-ink-soft transition-colors hover:bg-page focus:outline-none"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>条</span>
          </label>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={btn}
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft size={15} />
          上一页
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
        >
          下一页
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
