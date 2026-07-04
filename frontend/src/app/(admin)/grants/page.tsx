"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, Eye, Pencil, Trash2, Download } from "lucide-react";
import { grantApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toolbar } from "@/components/base-data/toolbar";
import { DataTable, type Column } from "@/components/base-data/data-table";
import { Pagination } from "@/components/base-data/pagination";
import { GrantStatusBadge } from "@/components/grant/grant-status-badge";
import { canEditGrant, grantTypeLabel, GRANT_STATUS_OPTIONS } from "@/lib/grant-options";
import type { GrantListItem } from "@/types/grant";

const DEFAULT_PAGE_SIZE = 20;

export default function GrantsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isStudent = role === "student";

  const [list, setList] = React.useState<GrantListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = React.useState(true);
  const [keywordInput, setKeywordInput] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<GrantListItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await grantApi.list({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        status: filterStatus || undefined,
      });
      setList(res.items);
      setTotal(res.total);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, filterStatus]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await grantApi.remove(deleteTarget.id);
      toast.success("已删除");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<GrantListItem>[] = [
    { header: "姓名", cell: (r) => r.student_name || "—" },
    { header: "学号", cell: (r) => <span className="font-mono">{r.student_no}</span> },
    { header: "年度", cell: (r) => r.year },
    { header: "类型", cell: (r) => grantTypeLabel(r.grant_type) },
    { header: "状态", cell: (r) => <GrantStatusBadge status={r.status} /> },
    {
      header: "操作",
      width: "160px",
      cell: (r) => (
        <div className="flex gap-2">
          <Link href={`/grants/${r.id}`} className="text-xs text-link hover:underline">
            <Eye size={14} className="inline" /> 查看
          </Link>
          {isStudent && canEditGrant(r.status) && (
            <Link href={`/grants/${r.id}/edit`} className="text-xs text-link hover:underline">
              <Pencil size={14} className="inline" /> 编辑
            </Link>
          )}
          {r.status === "approved" && (
            <button
              type="button"
              className="text-xs text-link hover:underline"
              onClick={() => grantApi.exportPdf(r.id)}
            >
              <Download size={14} className="inline" /> PDF
            </button>
          )}
          {isStudent && canEditGrant(r.status) && (
            <button type="button" className="text-xs text-error hover:underline" onClick={() => setDeleteTarget(r)}>
              <Trash2 size={14} className="inline" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <Toolbar>
        <Input placeholder="姓名/学号" value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} className="w-40" />
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-36">
          <option value="">全部状态</option>
          {GRANT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <Button variant="outline" size="sm" onClick={() => { setKeyword(keywordInput.trim()); setPage(1); }}>
          <Search size={16} /> 查询
        </Button>
        {isStudent && (
          <Link href="/grants/new">
            <Button size="sm"><Plus size={16} /> 新建申请</Button>
          </Link>
        )}
      </Toolbar>

      <DataTable columns={columns} data={list} rowKey={(r) => r.id} loading={loading} emptyLabel="暂无助学金申请" />
      <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除助学金申请"
        description="确定删除该草稿申请吗？"
        confirmText="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
