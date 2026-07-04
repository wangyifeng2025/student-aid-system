"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

// 列表底部分页条：展示区间统计 + 上下页切换。
export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const btn =
    "inline-flex h-8 items-center gap-1 rounded-sm border border-line bg-surface px-2.5 text-sm text-ink-soft transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="mt-3 flex items-center justify-between text-sm text-ink-mute">
      <span className="tabular-nums">
        共 {total} 条，第 {page}/{totalPages} 页（{from}–{to}）
      </span>
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
