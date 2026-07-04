"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, Eye, Pencil, Trash2, Download, Undo2 } from "lucide-react";
import { recognitionApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toolbar } from "@/components/base-data/toolbar";
import { DataTable, type Column } from "@/components/base-data/data-table";
import { Pagination } from "@/components/base-data/pagination";
import { BatchDeleteButton, checkboxColumn } from "@/components/base-data/batch-delete-button";
import { useRowSelection } from "@/hooks/use-row-selection";
import { StatusBadge } from "@/components/recognition/status-badge";
import {
  STATUS_META,
  difficultyLabel,
  difficultyTone,
  canDeleteRecognition,
  canWithdrawRecognition,
} from "@/lib/recognition-options";
import type { RecognitionListItem } from "@/types/recognition";

const DEFAULT_PAGE_SIZE = 20;

export default function RecognitionsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isStudent = role === "student";

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

  const [deleteTarget, setDeleteTarget] = React.useState<RecognitionListItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [withdrawTarget, setWithdrawTarget] = React.useState<RecognitionListItem | null>(null);
  const [withdrawing, setWithdrawing] = React.useState(false);

  const { selected, toggleRow, toggleAll, allSelected, clearSelection } = useRowSelection(
    list.filter((r) => canDeleteRecognition(r.status)),
    (r) => r.id,
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await recognitionApi.list({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        status: filterStatus || undefined,
        year: filterYear ? Number(filterYear) : undefined,
      });
      setList(res.items);
      setTotal(res.total);
      clearSelection();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, filterStatus, filterYear, clearSelection]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const submitSearch = () => {
    setKeyword(keywordInput.trim());
    setFilterYear(yearInput);
    setPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await recognitionApi.remove(deleteTarget.id);
      toast.success("已删除申请");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    try {
      await recognitionApi.withdraw(withdrawTarget.id);
      toast.success("已撤回申请，可继续编辑后重新提交");
      setWithdrawTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "撤回失败");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleExport = async (id: number) => {
    try {
      await recognitionApi.exportDocx(id);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "导出失败");
    }
  };

  const columns: Column<RecognitionListItem>[] = [
    ...(isStudent
      ? [
          checkboxColumn(
            selected,
            allSelected,
            toggleAll,
            toggleRow,
            (r) => r.id,
            (r) => r.student_name || String(r.id),
            (r) => canDeleteRecognition(r.status),
          ),
        ]
      : []),
    {
      header: "姓名",
      width: "96px",
      cell: (r) => <span className="text-ink">{r.student_name || "—"}</span>,
    },
    ...(isStudent
      ? []
      : [
          {
            header: "学号",
            cell: (r: RecognitionListItem) => <span className="font-mono">{r.student_no || "—"}</span>,
          },
        ]),
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
      header: "人均年收入",
      width: "120px",
      cell: (r) => (
        <span className="tabular-nums">
          {r.per_capita_annual_income ? `¥${r.per_capita_annual_income.toLocaleString()}` : "—"}
        </span>
      ),
    },
    {
      header: "操作",
      width: "200px",
      cell: (r) => (
        <div className="flex items-center gap-3 text-xs">
          <Link href={`/recognitions/${r.id}`} className="inline-flex items-center gap-1 text-link hover:underline">
            <Eye size={14} />
            查看
          </Link>
          {isStudent && canDeleteRecognition(r.status) && (
            <>
              <Link
                href={`/recognitions/${r.id}/edit`}
                className="inline-flex items-center gap-1 text-link hover:underline"
              >
                <Pencil size={14} />
                编辑
              </Link>
              <button
                type="button"
                onClick={() => setDeleteTarget(r)}
                className="inline-flex items-center gap-1 hover:underline"
                style={{ color: "var(--state-error)" }}
              >
                <Trash2 size={14} />
                删除
              </button>
            </>
          )}
          {isStudent && canWithdrawRecognition(r.status) && (
            <button
              type="button"
              onClick={() => setWithdrawTarget(r)}
              className="inline-flex items-center gap-1 text-link hover:underline"
            >
              <Undo2 size={14} />
              撤回
            </button>
          )}
          {r.status === "approved" && (
            <button
              type="button"
              onClick={() => handleExport(r.id)}
              className="inline-flex items-center gap-1 text-link hover:underline"
            >
              <Download size={14} />
              Word
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <Toolbar>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          {!isStudent && (
            <div className="relative min-w-0" style={{ width: 240 }}>
              <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-mute" />
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                placeholder="搜索姓名 / 学号 / 班级…"
                className="h-9 pl-8 text-sm"
              />
            </div>
          )}
          <Select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部状态</option>
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
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
        {isStudent && (
          <div className="flex items-center gap-2">
            <BatchDeleteButton
              selectedIds={selected}
              deleteOne={(id) => recognitionApi.remove(id)}
              onDone={load}
              entityLabel="认定申请"
              canWrite={isStudent}
              hint={`确定删除选中的 ${selected.size} 条认定申请吗？仅未提交的草稿或被退回申请可删除，已提交或审核中的将自动跳过。此操作不可撤销。`}
            />
            <Link href="/recognitions/new">
              <Button size="sm">
                <Plus size={16} />
                填报新申请
              </Button>
            </Link>
          </div>
        )}
      </Toolbar>

      <DataTable
        columns={columns}
        data={list}
        rowKey={(r) => r.id}
        loading={loading}
        error={error}
        onRetry={load}
        emptyLabel={
          isStudent ? "暂无认定申请，点击右上角「填报新申请」开始" : "暂无可审阅的认定申请"
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除认定申请"
        description={`确定删除 ${deleteTarget?.year} 年度的认定申请吗？仅未提交的申请可删除，该操作不可撤销。`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={withdrawTarget !== null}
        title="撤回认定申请"
        description={`确定撤回 ${withdrawTarget?.year} 年度的认定申请吗？撤回后将恢复为草稿，可继续编辑后重新提交。班级已审核后不可撤回。`}
        confirmText="确认撤回"
        loading={withdrawing}
        onConfirm={handleWithdraw}
        onCancel={() => setWithdrawTarget(null)}
      />
    </div>
  );
}
