"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Eye } from "lucide-react";
import { grantReviewApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toolbar } from "@/components/base-data/toolbar";
import { DataTable, type Column } from "@/components/base-data/data-table";
import { Pagination } from "@/components/base-data/pagination";
import { StatTabBar } from "@/components/review/stat-tab-bar";
import {
  OrgScopeFilters,
  orgScopeParams,
  type OrgScopeValue,
} from "@/components/review/org-scope-filters";
import { GrantStatusBadge } from "@/components/grant/grant-status-badge";
import {
  GRANT_STATUS_OPTIONS,
  grantRecordsTodoStatusOptionsForRole,
  grantTypeLabel,
} from "@/lib/grant-options";
import type { GrantListItem } from "@/types/grant";

type Tab = "all" | "todo" | "done";

const TAB_ITEMS = [
  {
    value: "all" as Tab,
    label: "全部",
    hint: "数据范围内全部已提交申请（不含草稿）",
    accentColor: "var(--color-primary)",
  },
  {
    value: "todo" as Tab,
    label: "待审核",
    hint: "需您本人审核，或下级部门正在审核的申请",
    accentColor: "var(--state-info)",
  },
  {
    value: "done" as Tab,
    label: "已审核",
    hint: "您本人已审核过的申请",
    accentColor: "var(--state-success)",
  },
];

function parseTab(v: string | null): Tab {
  if (v === "todo" || v === "done" || v === "all") return v;
  return "all";
}

export default function GrantReviewRecordsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useAuthStore((s) => s.user?.role);
  const tab = parseTab(searchParams.get("tab"));

  const [list, setList] = React.useState<GrantListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [counts, setCounts] = React.useState<Record<Tab, number>>({ all: 0, todo: 0, done: 0 });
  const [countsLoading, setCountsLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [keywordInput, setKeywordInput] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [yearInput, setYearInput] = React.useState("");
  const [filterYear, setFilterYear] = React.useState("");
  const [orgScope, setOrgScope] = React.useState<OrgScopeValue>({ deptId: 0, classId: 0 });

  const statusOptions =
    tab === "todo" ? grantRecordsTodoStatusOptionsForRole(role) : GRANT_STATUS_OPTIONS;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await grantReviewApi.records({
        tab,
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        status: filterStatus || undefined,
        year: filterYear ? Number(filterYear) : undefined,
        ...orgScopeParams(orgScope),
      });
      setList(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageSize, keyword, filterStatus, filterYear, orgScope]);

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
      status: filterStatus || undefined,
      year: filterYear ? Number(filterYear) : undefined,
      ...orgScopeParams(orgScope),
    };
    (async () => {
      try {
        const [allRes, todoRes, doneRes] = await Promise.all([
          grantReviewApi.records({ ...base, tab: "all" }),
          grantReviewApi.records({ ...base, tab: "todo" }),
          grantReviewApi.records({ ...base, tab: "done" }),
        ]);
        if (!cancelled) {
          setCounts({ all: allRes.total, todo: todoRes.total, done: doneRes.total });
        }
      } catch {
        if (!cancelled) setCounts({ all: 0, todo: 0, done: 0 });
      } finally {
        if (!cancelled) setCountsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [keyword, filterStatus, filterYear, orgScope]);

  const setTab = (t: string) => {
    router.push(`/grant-reviews/records?tab=${t}`);
    setPage(1);
    setFilterStatus("");
  };

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
      cell: (r) => (
        <Link
          href={`/grant-reviews/${r.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline"
        >
          <Eye size={14} /> 查看
        </Link>
      ),
    },
  ];

  const activeTabHint = TAB_ITEMS.find((t) => t.value === tab)?.hint ?? "";

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
            <Search size={16} /> 查询
          </Button>
        </div>
      </Toolbar>

      <StatTabBar
        items={TAB_ITEMS.map((t) => ({
          value: t.value,
          label: t.label,
          count: counts[t.value],
          accentColor: t.accentColor,
        }))}
        active={tab}
        onChange={setTab}
        loading={countsLoading}
      />

      {activeTabHint && <p className="mb-4 text-xs text-ink-mute">{activeTabHint}</p>}

      <DataTable
        columns={columns}
        data={list}
        rowKey={(r) => r.id}
        loading={loading}
        error={error}
        onRetry={load}
        emptyLabel={
          tab === "todo" ? "暂无待审核或下级在审的助学金申请" : "暂无助学金记录"
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
