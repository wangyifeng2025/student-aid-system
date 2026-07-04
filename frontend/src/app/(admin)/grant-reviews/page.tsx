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
  const [keywordInput, setKeywordInput] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await grantReviewApi.todo({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        status: filterStatus || undefined,
      });
      setList(res.items);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, filterStatus]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const columns: Column<GrantListItem>[] = [
    { header: "姓名", cell: (r) => r.student_name },
    { header: "学号", cell: (r) => <span className="font-mono">{r.student_no}</span> },
    { header: "班级", cell: (r) => r.class_name },
    { header: "年度", cell: (r) => r.year },
    { header: "类型", cell: (r) => grantTypeLabel(r.grant_type) },
    { header: "状态", cell: (r) => <GrantStatusBadge status={r.status} /> },
    {
      header: "操作",
      cell: (r) => (
        <Link href={`/grant-reviews/${r.id}`} className="inline-flex items-center gap-1 text-xs text-link hover:underline">
          <Eye size={14} /> 审核
        </Link>
      ),
    },
  ];

  return (
    <div>
      <Toolbar>
        <Input placeholder="姓名/学号" value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} className="w-40" />
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-36">
          <option value="">全部待办状态</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <Button variant="outline" size="sm" onClick={() => { setKeyword(keywordInput.trim()); setPage(1); }}>
          <Search size={16} /> 查询
        </Button>
      </Toolbar>
      <DataTable columns={columns} data={list} rowKey={(r) => r.id} loading={loading} emptyLabel="暂无待办助学金申请" />
      <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
    </div>
  );
}
