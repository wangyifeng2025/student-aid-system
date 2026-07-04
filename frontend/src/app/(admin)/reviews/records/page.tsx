"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, Eye } from "lucide-react";
import { reviewApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Toolbar } from "@/components/base-data/toolbar";
import { DataTable, type Column } from "@/components/base-data/data-table";
import { Pagination } from "@/components/base-data/pagination";
import { StatusBadge } from "@/components/recognition/status-badge";
import {
  difficultyLabel,
  difficultyTone,
  levelName,
  RECORDS_STATUS_OPTIONS,
  todoStatusOptionsForRole,
} from "@/lib/recognition-options";
import type { RecognitionListItem } from "@/types/recognition";

const PAGE_SIZE = 20;

type RecordsTab = "all" | "todo" | "done";

const TAB_ITEMS: { value: RecordsTab; label: string; hint: string }[] = [
  { value: "all", label: "全部", hint: "数据范围内所有已提交的认定申请（不含学生草稿）" },
  { value: "todo", label: "待审核", hint: "当前轮到您处理的申请" },
  { value: "done", label: "已审核", hint: "您已处理过或已流转至下一环节的申请" },
];

function parseTab(v: string | null): RecordsTab {
  if (v === "todo" || v === "done" || v === "all") return v;
  return "all";
}

export default function ReviewRecordsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useAuthStore((s) => s.user?.role);

  const tab = parseTab(searchParams.get("tab"));

  const [list, setList] = React.useState<RecognitionListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [keywordInput, setKeywordInput] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [yearInput, setYearInput] = React.useState("");
  const [filterYear, setFilterYear] = React.useState("");

  const setTab = (next: RecordsTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.push(`/reviews/records?${params.toString()}`);
    setPage(1);
    setFilterStatus("");
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reviewApi.records({
        tab,
        page,
        page_size: PAGE_SIZE,
        keyword: keyword || undefined,
        status: filterStatus || undefined,
        year: filterYear ? Number(filterYear) : undefined,
      });
      setList(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [tab, page, keyword, filterStatus, filterYear]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const submitSearch = () => {
    setKeyword(keywordInput.trim());
    setFilterYear(yearInput);
    setPage(1);
  };

  const statusOptions =
    tab === "todo" ? todoStatusOptionsForRole(role) : RECORDS_STATUS_OPTIONS;

  const activeTabHint = TAB_ITEMS.find((t) => t.value === tab)?.hint ?? "";

  const columns: Column<RecognitionListItem>[] = [
    {
      header: "姓名",
      width: "96px",
      cell: (r) => <span className="font-medium text-ink">{r.student_name || "—"}</span>,
    },
    {
      header: "学号",
      cell: (r) => <span className="font-mono">{r.student_no || "—"}</span>,
    },
    {
      header: "专业",
      width: "160px",
      cell: (r) => <span className="text-ink">{r.major_name || "—"}</span>,
    },
    {
      header: "班级",
      width: "140px",
      cell: (r) => <span className="text-ink">{r.class_name || "—"}</span>,
    },
    {
      header: "年度",
      width: "80px",
      cell: (r) => <span className="tabular-nums">{r.year || "—"}</span>,
    },
    { header: "状态", width: "120px", cell: (r) => <StatusBadge status={r.status} /> },
    {
      header: "当前级别",
      width: "110px",
      cell: (r) => <span className="text-sm">{levelName(r.current_level)}</span>,
    },
    {
      header: "困难等级",
      width: "100px",
      cell: (r) =>
        r.difficulty_level ? (
          <Badge tone={difficultyTone(r.difficulty_level)}>
            {difficultyLabel(r.difficulty_level)}
          </Badge>
        ) : (
          <span className="text-ink-mute">未评定</span>
        ),
    },
    {
      header: "操作",
      width: "80px",
      cell: (r) => (
        <Link
          href={`/reviews/${r.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline"
        >
          <Eye size={14} />
          查看
        </Link>
      ),
    },
  ];

  return (
    <div>
      <p className="mb-4 text-sm text-ink-soft">{activeTabHint}</p>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-border pb-3">
        {TAB_ITEMS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className="rounded-md px-3 py-1.5 text-sm transition-colors"
            style={{
              backgroundColor: tab === item.value ? "var(--color-primary-subtle)" : "transparent",
              color: tab === item.value ? "var(--color-primary)" : "var(--color-ink-soft)",
              fontWeight: tab === item.value ? 600 : 400,
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Toolbar>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-0" style={{ width: 240 }}>
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-mute"
            />
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSearch()}
              placeholder="搜索姓名 / 学号…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部状态</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            value={yearInput}
            onChange={(e) => setYearInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && submitSearch()}
            placeholder="年度"
            className="h-9 w-24 text-sm"
          />
          <Button variant="outline" size="sm" onClick={submitSearch}>
            查询
          </Button>
        </div>
      </Toolbar>

      <DataTable
        columns={columns}
        data={list}
        rowKey={(r) => r.id}
        loading={loading}
        error={error}
        onRetry={load}
        emptyLabel={
          tab === "todo"
            ? "暂无待审核申请"
            : tab === "done"
              ? "暂无已审核记录"
              : "暂无认定记录"
        }
      />

      {!loading && !error && total > 0 && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
      )}
    </div>
  );
}
