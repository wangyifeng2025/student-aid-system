"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Eye, Check, Undo2, Download } from "lucide-react";
import { reviewApi, recognitionApi, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Toolbar } from "@/components/base-data/toolbar";
import { DataTable, CellText, type Column } from "@/components/base-data/data-table";
import { Pagination } from "@/components/base-data/pagination";
import { StatusBadge } from "@/components/recognition/status-badge";
import { ReviewActionDialog } from "@/components/review/review-action-dialog";
import { StatTabBar } from "@/components/review/stat-tab-bar";
import { LoadingState } from "@/components/ui/states";
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
  RECORDS_STATUS_OPTIONS,
  canExportRecognitionSummary,
  SPECIAL_GROUP_OPTIONS,
  specialTypesText,
} from "@/lib/recognition-options";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";
import type {
  RecognitionListItem,
  ReviewActionInput,
  ReviewActionType,
} from "@/types/recognition";

const DEFAULT_PAGE_SIZE = 20;

type ReviewTab = "todo" | "done" | "all";

const TAB_ITEMS: { value: ReviewTab; label: string; hint: string; accentColor: string }[] = [
  {
    value: "todo",
    label: "待办",
    hint: "轮到您本级处理的申请，可逐条审核或勾选后批量通过 / 退回。",
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
    hint: "数据范围内所有已提交的认定申请（不含草稿）。院系 / 中心可在此查看下级尚未审核的申请。",
    accentColor: "var(--color-primary)",
  },
];

function parseTab(v: string | null): ReviewTab {
  if (v === "todo" || v === "done" || v === "all") return v;
  return "todo";
}

export default function ReviewsPage() {
  return (
    <React.Suspense fallback={<LoadingState />}>
      <ReviewsWorkbench />
    </React.Suspense>
  );
}

function ReviewsWorkbench() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useAuthStore((s) => s.user?.role);
  const tab = parseTab(searchParams.get("tab"));
  const isTodo = tab === "todo";

  const [list, setList] = React.useState<RecognitionListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [keywordInput, setKeywordInput] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterSpecialType, setFilterSpecialType] = React.useState("");
  const [yearInput, setYearInput] = React.useState("");
  const [filterYear, setFilterYear] = React.useState("");
  const [orgScope, setOrgScope] = React.useState<OrgScopeValue>({ deptId: 0, classId: 0 });
  const [exportingSummary, setExportingSummary] = React.useState(false);
  const canExportSummary = canExportRecognitionSummary(role);

  const [tabCounts, setTabCounts] = React.useState<Record<ReviewTab, number>>({
    todo: 0,
    done: 0,
    all: 0,
  });
  const [countsLoading, setCountsLoading] = React.useState(true);

  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [batchDialog, setBatchDialog] = React.useState<ReviewActionType | null>(null);
  const [batching, setBatching] = React.useState(false);

  const statusOptions = React.useMemo(
    () => (isTodo ? todoStatusOptionsForRole(role) : RECORDS_STATUS_OPTIONS),
    [isTodo, role],
  );

  const setTab = (next: ReviewTab) => {
    router.replace(`/reviews?tab=${next}`);
    setPage(1);
    setFilterStatus("");
    setSelected(new Set());
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const filter = {
      page,
      page_size: pageSize,
      keyword: keyword || undefined,
      status: filterStatus || undefined,
      special_type: filterSpecialType || undefined,
      year: filterYear ? Number(filterYear) : undefined,
      ...orgScopeParams(orgScope),
    };
    try {
      const res = isTodo
        ? await reviewApi.todo(filter)
        : await reviewApi.records({ ...filter, tab });
      setList(res.items);
      setTotal(res.total);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [isTodo, tab, page, pageSize, keyword, filterStatus, filterSpecialType, filterYear, orgScope]);

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
      special_type: filterSpecialType || undefined,
      year: filterYear ? Number(filterYear) : undefined,
      ...orgScopeParams(orgScope),
    };
    (async () => {
      try {
        const [todoRes, doneRes, allRes] = await Promise.all([
          reviewApi.todo(base),
          reviewApi.records({ ...base, tab: "done" }),
          reviewApi.records({ ...base, tab: "all" }),
        ]);
        if (!cancelled) {
          setTabCounts({
            todo: todoRes.total,
            done: doneRes.total,
            all: allRes.total,
          });
        }
      } catch {
        if (!cancelled) setTabCounts({ todo: 0, done: 0, all: 0 });
      } finally {
        if (!cancelled) setCountsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [keyword, filterSpecialType, filterYear, orgScope]);

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
        special_type: filterSpecialType || undefined,
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
    ...(isTodo
      ? [
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
            cell: (r: RecognitionListItem) => (
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggleRow(r.id)}
                aria-label={`选择 ${r.student_name}`}
                className="cursor-pointer"
              />
            ),
          } satisfies Column<RecognitionListItem>,
        ]
      : []),
    {
      header: "姓名",
      width: "88px",
      cell: (r) => (
        <CellText className="font-medium text-ink">{r.student_name || "—"}</CellText>
      ),
    },
    {
      header: "学号",
      width: "140px",
      cell: (r) => <CellText className="font-mono">{r.student_no || "—"}</CellText>,
    },
    {
      header: "专业",
      width: "140px",
      cell: (r) => <CellText>{r.major_name || "—"}</CellText>,
    },
    ...(!isTodo
      ? [
          {
            header: "院系",
            width: "140px",
            cell: (r: RecognitionListItem) => <CellText>{r.dept_name || "—"}</CellText>,
          } satisfies Column<RecognitionListItem>,
        ]
      : []),
    {
      header: "班级",
      width: "112px",
      cell: (r) => <CellText>{r.class_name || "—"}</CellText>,
    },
    {
      header: "年度",
      width: "64px",
      cell: (r) => <span className="tabular-nums">{r.year || "—"}</span>,
    },
    {
      header: "特殊群体",
      width: "160px",
      cell: (r) =>
        r.special_types?.length ? (
          <CellText title={specialTypesText(r.special_types)}>
            {specialTypesText(r.special_types)}
          </CellText>
        ) : (
          <span className="text-ink-mute">未勾选</span>
        ),
    },
    { header: "状态", width: "112px", cell: (r) => <StatusBadge status={r.status} /> },
    {
      header: "当前级别",
      width: "96px",
      cell: (r) => <span className="text-sm">{levelName(r.current_level)}</span>,
    },
    {
      header: "困难等级",
      width: "96px",
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
      width: isTodo ? "88px" : "128px",
      cell: (r) => (
        <div className="flex items-center gap-3 text-xs">
          <Link
            href={`/reviews/${r.id}`}
            className="inline-flex items-center gap-1 font-medium text-link hover:underline"
          >
            <Eye size={14} />
            {isTodo ? "审核" : "查看"}
          </Link>
          {!isTodo && r.status === "approved" && (
            <button
              type="button"
              onClick={() => {
                void recognitionApi.exportDocx(r.id).catch((e) => {
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
        items={TAB_ITEMS.map((item) => ({
          value: item.value,
          label: item.label,
          count: tabCounts[item.value],
          accentColor: item.accentColor,
        }))}
        active={tab}
        onChange={(v) => setTab(v as ReviewTab)}
        loading={countsLoading}
      />

      {activeTabHint && <p className="mb-4 text-xs text-ink-mute">{activeTabHint}</p>}

      <Toolbar>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="relative w-52 shrink-0">
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
            className="w-32 shrink-0"
          >
            <option value="">{isTodo ? "全部待办" : "全部状态"}</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            value={filterSpecialType}
            onChange={(e) => {
              setFilterSpecialType(e.target.value);
              setPage(1);
            }}
            className="w-40 min-w-0 shrink-0"
          >
            <option value="">全部特殊群体</option>
            {SPECIAL_GROUP_OPTIONS.map((o) => (
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
            className="h-9 w-20 shrink-0 text-sm"
          />
          <Button variant="outline" size="sm" className="shrink-0" onClick={submitSearch}>
            查询
          </Button>
        </div>
        {canExportSummary && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={exportingSummary}
            onClick={() => void handleExportSummary()}
            title="导出当前筛选范围内已认定通过的学生汇总表"
          >
            <Download size={16} />
            {exportingSummary ? "导出中…" : "导出汇总表"}
          </Button>
        )}
      </Toolbar>

      {isTodo && selected.size > 0 && (
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
        emptyLabel={
          tab === "todo" ? "暂无待办申请" : tab === "done" ? "暂无已办理记录" : "暂无认定记录"
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
