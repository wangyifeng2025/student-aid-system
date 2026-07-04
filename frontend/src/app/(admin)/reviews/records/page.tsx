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
import { StatTabBar } from "@/components/review/stat-tab-bar";
import {
  difficultyLabel,
  difficultyTone,
  levelName,
  RECORDS_STATUS_OPTIONS,
  recordsTodoStatusOptionsForRole,
} from "@/lib/recognition-options";
import type { RecognitionListItem } from "@/types/recognition";

const DEFAULT_PAGE_SIZE = 20;

type RecordsTab = "all" | "todo" | "done";

const TAB_ITEMS: { value: RecordsTab; label: string; hint: string; accentColor: string }[] = [
  { value: "all", label: "全部", hint: "数据范围内所有已提交的认定申请（不含学生草稿）", accentColor: "var(--color-primary)" },
  { value: "todo", label: "待审核", hint: "需您本人审核，或下级部门正在审核的申请", accentColor: "var(--state-info)" },
  { value: "done", label: "已审核", hint: "您本人已审核过的申请", accentColor: "var(--state-success)" },
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
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [keywordInput, setKeywordInput] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [yearInput, setYearInput] = React.useState("");
  const [filterYear, setFilterYear] = React.useState("");

  const [tabCounts, setTabCounts] = React.useState<Record<RecordsTab, number>>({
    all: 0,
    todo: 0,
    done: 0,
  });
  const [countsLoading, setCountsLoading] = React.useState(true);

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
        page_size: pageSize,
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
  }, [tab, page, pageSize, keyword, filterStatus, filterYear]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // 并行拉取三个标签的数量（与当前筛选条件一致，不含分页）
  React.useEffect(() => {
    let cancelled = false;
    setCountsLoading(true);
    const base = {
      page: 1,
      page_size: 1,
      keyword: keyword || undefined,
      status: filterStatus || undefined,
      year: filterYear ? Number(filterYear) : undefined,
    };
    (async () => {
      try {
        const [allRes, todoRes, doneRes] = await Promise.all([
          reviewApi.records({ ...base, tab: "all" }),
          reviewApi.records({ ...base, tab: "todo" }),
          reviewApi.records({ ...base, tab: "done" }),
        ]);
        if (!cancelled) {
          setTabCounts({
            all: allRes.total,
            todo: todoRes.total,
            done: doneRes.total,
          });
        }
      } catch {
        if (!cancelled) setTabCounts({ all: 0, todo: 0, done: 0 });
      } finally {
        if (!cancelled) setCountsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [keyword, filterStatus, filterYear]);

  const submitSearch = () => {
    setKeyword(keywordInput.trim());
    setFilterYear(yearInput);
    setPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const statusOptions =
    tab === "todo" ? recordsTodoStatusOptionsForRole(role) : RECORDS_STATUS_OPTIONS;

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

      <StatTabBar
        items={TAB_ITEMS.map((item) => ({
          value: item.value,
          label: item.label,
          count: tabCounts[item.value],
          accentColor: item.accentColor,
        }))}
        active={tab}
        onChange={(v) => setTab(v as RecordsTab)}
        loading={countsLoading}
      />

      {activeTabHint && (
        <p className="mb-4 text-xs text-ink-mute">{activeTabHint}</p>
      )}

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
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
}
