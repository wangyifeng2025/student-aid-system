"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Eye, Download } from "lucide-react";
import { grantReviewApi, grantApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toolbar } from "@/components/base-data/toolbar";
import { DataTable, type Column } from "@/components/base-data/data-table";
import { Pagination } from "@/components/base-data/pagination";
import { GrantStatusBadge } from "@/components/grant/grant-status-badge";
import { StatTabBar } from "@/components/review/stat-tab-bar";
import { LoadingState } from "@/components/ui/states";
import {
  OrgScopeFilters,
  orgScopeParams,
  type OrgScopeValue,
} from "@/components/review/org-scope-filters";
import {
  GRANT_STATUS_OPTIONS,
  grantTodoStatusOptionsForRole,
  grantTypeLabel,
} from "@/lib/grant-options";
import type { GrantListItem } from "@/types/grant";

const DEFAULT_PAGE_SIZE = 20;

type ReviewTab = "todo" | "done" | "all";

const TAB_ITEMS: { value: ReviewTab; label: string; hint: string; accentColor: string }[] = [
  {
    value: "todo",
    label: "待办",
    hint: "轮到您本级处理的助学金申请，点开即可审核。",
    accentColor: "var(--state-info)",
  },
  {
    value: "done",
    label: "已办理",
    hint: "您本人已审核过的申请，便于查询与导出。",
    accentColor: "var(--state-success)",
  },
  {
    value: "all",
    label: "全部",
    hint: "数据范围内全部已提交申请（不含草稿）。院系 / 中心可在此查看下级尚未审核的申请。",
    accentColor: "var(--color-primary)",
  },
];

function parseTab(v: string | null): ReviewTab {
  if (v === "todo" || v === "done" || v === "all") return v;
  return "todo";
}

export default function GrantReviewsPage() {
  return (
    <React.Suspense fallback={<LoadingState />}>
      <GrantReviewsWorkbench />
    </React.Suspense>
  );
}

function GrantReviewsWorkbench() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useAuthStore((s) => s.user?.role);
  const tab = parseTab(searchParams.get("tab"));
  const isTodo = tab === "todo";

  const [list, setList] = React.useState<GrantListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [counts, setCounts] = React.useState<Record<ReviewTab, number>>({
    todo: 0,
    done: 0,
    all: 0,
  });
  const [countsLoading, setCountsLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [keywordInput, setKeywordInput] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [yearInput, setYearInput] = React.useState("");
  const [filterYear, setFilterYear] = React.useState("");
  const [orgScope, setOrgScope] = React.useState<OrgScopeValue>({ deptId: 0, classId: 0 });

  const statusOptions = isTodo ? grantTodoStatusOptionsForRole(role) : GRANT_STATUS_OPTIONS;

  const setTab = (next: ReviewTab) => {
    router.replace(`/grant-reviews?tab=${next}`);
    setPage(1);
    setFilterStatus("");
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const filter = {
      page,
      page_size: pageSize,
      keyword: keyword || undefined,
      status: filterStatus || undefined,
      year: filterYear ? Number(filterYear) : undefined,
      ...orgScopeParams(orgScope),
    };
    try {
      const res = isTodo
        ? await grantReviewApi.todo(filter)
        : await grantReviewApi.records({ ...filter, tab });
      setList(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [isTodo, tab, page, pageSize, keyword, filterStatus, filterYear, orgScope]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    let cancelled = false;
    setCountsLoading(true);
    const base = {
      page: 1,
      page_size: 1,
      keyword: keyword || undefined,
      year: filterYear ? Number(filterYear) : undefined,
      ...orgScopeParams(orgScope),
    };
    (async () => {
      try {
        const [todoRes, doneRes, allRes] = await Promise.all([
          grantReviewApi.todo(base),
          grantReviewApi.records({ ...base, tab: "done" }),
          grantReviewApi.records({ ...base, tab: "all" }),
        ]);
        if (!cancelled) {
          setCounts({ todo: todoRes.total, done: doneRes.total, all: allRes.total });
        }
      } catch {
        if (!cancelled) setCounts({ todo: 0, done: 0, all: 0 });
      } finally {
        if (!cancelled) setCountsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [keyword, filterYear, orgScope]);

  const submitSearch = () => {
    setKeyword(keywordInput.trim());
    setFilterYear(yearInput);
    setPage(1);
  };

  const columns: Column<GrantListItem>[] = [
    { header: "姓名", cell: (r) => <span className="font-medium text-ink">{r.student_name}</span> },
    { header: "学号", cell: (r) => <span className="font-mono">{r.student_no}</span> },
    { header: "院系", cell: (r) => r.dept_name || "—" },
    { header: "班级", cell: (r) => r.class_name || "—" },
    { header: "年度", cell: (r) => r.year },
    { header: "类型", cell: (r) => grantTypeLabel(r.grant_type) },
    { header: "状态", cell: (r) => <GrantStatusBadge status={r.status} /> },
    {
      header: "操作",
      width: "140px",
      cell: (r) => (
        <div className="flex items-center gap-3 text-xs">
          <Link
            href={`/grant-reviews/${r.id}`}
            className="inline-flex items-center gap-1 font-medium text-link hover:underline"
          >
            <Eye size={14} /> {isTodo ? "审核" : "查看"}
          </Link>
          {!isTodo && r.status === "approved" && (
            <button
              type="button"
              onClick={() => {
                void grantApi.exportDocx(r.id).catch((e) => {
                  toast.error(e instanceof ApiError ? e.message : "导出失败");
                });
              }}
              className="inline-flex items-center gap-1 font-medium text-link hover:underline"
            >
              <Download size={14} />
              申请表
            </button>
          )}
        </div>
      ),
    },
  ];

  const activeTabHint = TAB_ITEMS.find((t) => t.value === tab)?.hint ?? "";

  return (
    <div>
      <StatTabBar
        items={TAB_ITEMS.map((t) => ({
          value: t.value,
          label: t.label,
          count: counts[t.value],
          accentColor: t.accentColor,
        }))}
        active={tab}
        onChange={(v) => setTab(v as ReviewTab)}
        loading={countsLoading}
      />

      {activeTabHint && <p className="mb-4 text-xs text-ink-mute">{activeTabHint}</p>}

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
          <OrgScopeFilters
            value={orgScope}
            onChange={(next) => {
              setOrgScope(next);
              setPage(1);
            }}
          />
          <Select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="w-36"
          >
            <option value="">{isTodo ? "全部待办状态" : "全部状态"}</option>
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
            <Search size={16} /> 查询
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
            ? "暂无待办助学金申请"
            : tab === "done"
              ? "暂无已办理记录"
              : "暂无助学金记录"
        }
      />
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />
    </div>
  );
}
