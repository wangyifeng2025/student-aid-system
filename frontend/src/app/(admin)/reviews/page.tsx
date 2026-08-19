"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Eye, Check, Undo2, Download } from "lucide-react";
import { reviewApi, recognitionApi, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Toolbar } from "@/components/base-data/toolbar";
import { DataTable, type Column } from "@/components/base-data/data-table";
import { Pagination } from "@/components/base-data/pagination";
import { StatusBadge } from "@/components/recognition/status-badge";
import { ReviewActionDialog } from "@/components/review/review-action-dialog";
import {
  OrgScopeFilters,
  orgScopeParams,
  type OrgScopeValue,
} from "@/components/review/org-scope-filters";
import {
  difficultyLabel,
  difficultyTone,
  levelName,
  todoStatusOptionsForRole,
  canExportRecognitionSummary,
} from "@/lib/recognition-options";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";
import type {
  RecognitionListItem,
  ReviewActionInput,
  ReviewActionType,
} from "@/types/recognition";

const DEFAULT_PAGE_SIZE = 20;

export default function ReviewsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const statusOptions = React.useMemo(
    () => todoStatusOptionsForRole(role),
    [role],
  );
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
  const [orgScope, setOrgScope] = React.useState<OrgScopeValue>({ deptId: 0, classId: 0 });
  const [exportingSummary, setExportingSummary] = React.useState(false);
  const canExportSummary = canExportRecognitionSummary(role);

  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [batchDialog, setBatchDialog] = React.useState<ReviewActionType | null>(null);
  const [batching, setBatching] = React.useState(false);

  const showSubordinateHint = role === "department" || role === "aidcenter" || role === "admin";

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reviewApi.todo({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        status: filterStatus || undefined,
        year: filterYear ? Number(filterYear) : undefined,
        ...orgScopeParams(orgScope),
      });
      setList(res.items);
      setTotal(res.total);
      setSelected(new Set());
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

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const handleExportSummary = async () => {
    setExportingSummary(true);
    try {
      await recognitionApi.exportSummary({
        keyword: keyword || undefined,
        year: filterYear ? Number(filterYear) : undefined,
        ...orgScopeParams(orgScope),
      });
      toast.success("认定结果汇总表已导出");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "导出失败");
    } finally {
      setExportingSummary(false);
    }
  };

  const toggleRow = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = list.length > 0 && selected.size === list.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(list.map((r) => r.id)));
  };

  const handleBatch = async (input: ReviewActionInput) => {
    if (!batchDialog) return;
    setBatching(true);
    try {
      const res = await reviewApi.batch({
        ids: Array.from(selected),
        action: batchDialog,
        difficulty_level: input.difficulty_level,
        opinion: input.opinion,
        reject_to_level: input.reject_to_level,
      });
      if (res.failed === 0) {
        toast.success(`批量${batchDialog === "pass" ? "通过" : "退回"}成功，共 ${res.success} 条`);
      } else {
        toast.info(`成功 ${res.success} 条，失败 ${res.failed} 条`);
        const firstFail = res.items.find((i) => !i.ok);
        if (firstFail?.message) toast.error(`部分失败：${firstFail.message}`);
      }
      setBatchDialog(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "批量操作失败");
    } finally {
      setBatching(false);
    }
  };

  const columns: Column<RecognitionListItem>[] = [
    {
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          aria-label="全选"
          className="cursor-pointer"
        />
      ),
      width: "40px",
      cell: (r) => (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onChange={() => toggleRow(r.id)}
          aria-label={`选择 ${r.student_name}`}
          className="cursor-pointer"
        />
      ),
    },
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
      width: "100px",
      cell: (r) => (
        <Link
          href={`/reviews/${r.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline"
        >
          <Eye size={14} />
          审核
        </Link>
      ),
    },
  ];

  return (
    <div>
      <p className="mb-4 text-sm text-ink-soft">
        按您的数据范围与评审级别展示本级待办。可逐条审核，或勾选后批量通过 / 退回。
        {showSubordinateHint && (
          <>
            {" "}
            若需查看下级尚未审核的申请，请前往
            <Link href="/reviews/records?tab=todo" className="mx-1 text-link hover:underline">
              认定记录 · 待审核
            </Link>
            （可按班级 / 院系 / 姓名筛选）。
          </>
        )}
      </p>

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
            <option value="">全部待办</option>
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
        {canExportSummary && (
          <Button
            variant="outline"
            size="sm"
            disabled={exportingSummary}
            onClick={() => void handleExportSummary()}
            title="导出当前筛选范围内已认定通过的学生汇总表"
          >
            <Download size={16} />
            {exportingSummary ? "导出中…" : "导出汇总表"}
          </Button>
        )}
      </Toolbar>

      {selected.size > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-3 rounded-md px-4 py-2.5"
          style={{ backgroundColor: "var(--color-primary-subtle)" }}
        >
          <span className="text-sm text-ink">已选择 {selected.size} 条</span>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setBatchDialog("pass")}>
              <Check size={14} />
              批量通过
            </Button>
            <Button size="sm" variant="danger" onClick={() => setBatchDialog("reject")}>
              <Undo2 size={14} />
              批量退回
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              取消选择
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={list}
        rowKey={(r) => r.id}
        loading={loading}
        error={error}
        onRetry={load}
        emptyLabel="暂无待办申请"
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

      <ReviewActionDialog
        open={batchDialog !== null}
        action={batchDialog ?? "pass"}
        currentLevel={4}
        requireDifficulty={false}
        loading={batching}
        onConfirm={handleBatch}
        onCancel={() => setBatchDialog(null)}
      />
    </div>
  );
}
