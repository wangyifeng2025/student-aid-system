"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Eye } from "lucide-react";
import { grantReviewApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toolbar } from "@/components/base-data/toolbar";
import { DataTable, type Column } from "@/components/base-data/data-table";
import { Pagination } from "@/components/base-data/pagination";
import { GrantStatusBadge } from "@/components/grant/grant-status-badge";
import {
  OrgScopeFilters,
  orgScopeParams,
  type OrgScopeValue,
} from "@/components/review/org-scope-filters";
import { grantTodoStatusOptionsForRole, grantTypeLabel } from "@/lib/grant-options";
import type { GrantListItem } from "@/types/grant";

const DEFAULT_PAGE_SIZE = 20;

export default function GrantReviewsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const statusOptions = React.useMemo(() => grantTodoStatusOptionsForRole(role), [role]);
  const [list, setList] = React.useState<GrantListItem[]>([]);
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
  const [orgScope, setOrgScope] = React.useState<OrgScopeValue>({ deptId: 0, classId: 0 });

  const showSubordinateHint = role === "department" || role === "aidcenter" || role === "admin";

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await grantReviewApi.todo({
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
  }, [page, pageSize, keyword, filterStatus, filterYear, orgScope]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const submitSearch = () => {
    setKeyword(keywordInput.trim());
    setFilterYear(yearInput);
    setPage(1);
  };

  const columns: Column<GrantListItem>[] = [
    { header: "姓名", cell: (r) => r.student_name },
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
          className="inline-flex items-center gap-1 text-xs text-link hover:underline"
        >
          <Eye size={14} /> 审核
        </Link>
      ),
    },
  ];

  return (
    <div>
      <p className="mb-4 text-sm text-ink-soft">
        本页仅展示需您本级处理的助学金待办。
        {showSubordinateHint && (
          <>
            {" "}
            查看班级 / 教学系尚未审核的申请，请前往
            <Link href="/grant-reviews/records?tab=todo" className="mx-1 text-link hover:underline">
              助学金记录 · 待审核
            </Link>
            。
          </>
        )}
      </p>
      <Toolbar>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <Input
            placeholder="姓名/学号"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitSearch()}
            className="w-40"
          />
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
            <option value="">全部待办状态</option>
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
        emptyLabel="暂无待办助学金申请"
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
