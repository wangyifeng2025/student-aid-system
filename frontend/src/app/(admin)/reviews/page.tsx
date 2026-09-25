"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, Check, Undo2, Download } from "lucide-react";
import { reviewApi, recognitionApi, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Toolbar, ToolbarActions, ToolbarFilters, ToolbarSearch } from "@/components/base-data/toolbar";
import {
  DataTable,
  CellText,
  type Column,
} from "@/components/base-data/data-table";
import { Pagination } from "@/components/base-data/pagination";
import { checkboxColumn } from "@/components/base-data/batch-delete-button";
import { StatusBadge } from "@/components/recognition/status-badge";
import { ProofPreviewCell } from "@/components/recognition/proof-preview-cell";
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
  DIFFICULTY_OPTIONS,
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
type KeyFilter = "" | "true" | "false";

const TAB_ITEMS: {
  value: ReviewTab;
  label: string;
  hint: string;
  accentColor: string;
}[] = [
  {
    value: "todo",
    label: "待办",
    hint: "轮到您本级处理的申请，可逐条审核、勾选后批量通过 / 退回，或导出本级待审 / 已选记录。",
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
  const searchParams = useSearchParams();
  const role = useAuthStore((s) => s.user?.role);
  // 刷新后 router.replace 往往不更新 useSearchParams，页签会停在原值。
  // 选中项以本地状态为准，地址栏只作同步。
  const [tab, setTabState] = React.useState<ReviewTab>(() =>
    parseTab(searchParams.get("tab")),
  );
  const isTodo = tab === "todo";

  const [list, setList] = React.useState<RecognitionListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [listSnapshotKey, setListSnapshotKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [keywordInput, setKeywordInput] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterSpecialType, setFilterSpecialType] = React.useState("");
  const [filterKey, setFilterKey] = React.useState<KeyFilter>("");
  const [filterDifficulty, setFilterDifficulty] = React.useState("");
  const [yearInput, setYearInput] = React.useState("");
  const [filterYear, setFilterYear] = React.useState("");
  const [orgScope, setOrgScope] = React.useState<OrgScopeValue>({
    deptId: 0,
    classId: 0,
  });
  const [exportingSummary, setExportingSummary] = React.useState(false);
  const canExportSummary = canExportRecognitionSummary(role);

  const [tabCounts, setTabCounts] = React.useState<Record<ReviewTab, number>>({
    todo: 0,
    done: 0,
    all: 0,
  });
  const [countsSnapshotKey, setCountsSnapshotKey] = React.useState<string | null>(
    null,
  );

  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [batchDialog, setBatchDialog] = React.useState<ReviewActionType | null>(
    null,
  );
  const [batching, setBatching] = React.useState(false);

  const statusOptions = React.useMemo(
    () => (isTodo ? todoStatusOptionsForRole(role) : RECORDS_STATUS_OPTIONS),
    [isTodo, role],
  );

  const setTab = (next: ReviewTab) => {
    setTabState(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    // 带上现有 history.state（含 __NA），只改地址栏，避免被路由当成整页跳转。
    const current = window.history.state;
    window.history.replaceState(
      current?.__NA ? current : { ...current, __NA: true },
      "",
      `/reviews?${params.toString()}`,
    );
    setPage(1);
    setFilterStatus("");
    setSelected(new Set());
  };

  const listQueryKey = React.useMemo(
    () =>
      JSON.stringify({
        isTodo,
        tab,
        page,
        pageSize,
        keyword,
        filterStatus,
        filterSpecialType,
        filterKey,
        filterDifficulty,
        filterYear,
        orgScope,
      }),
    [
      isTodo,
      tab,
      page,
      pageSize,
      keyword,
      filterStatus,
      filterSpecialType,
      filterKey,
      filterDifficulty,
      filterYear,
      orgScope,
    ],
  );
  const loading = listSnapshotKey !== listQueryKey;

  const countsFilterKey = React.useMemo(
    () =>
      JSON.stringify({
        keyword,
        filterSpecialType,
        filterKey,
        filterDifficulty,
        filterYear,
        orgScope,
      }),
    [keyword, filterSpecialType, filterKey, filterDifficulty, filterYear, orgScope],
  );
  const countsLoading = countsSnapshotKey !== countsFilterKey;

  const load = React.useCallback(async () => {
    const filter = {
      page,
      page_size: pageSize,
      keyword: keyword || undefined,
      status: filterStatus || undefined,
      special_type: filterSpecialType || undefined,
      is_key_group: filterKey === "" ? undefined : filterKey === "true",
      difficulty_level: filterDifficulty || undefined,
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
      setError(null);
      setListSnapshotKey(listQueryKey);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
      setListSnapshotKey(listQueryKey);
    }
  }, [
    listQueryKey,
    isTodo,
    tab,
    page,
    pageSize,
    keyword,
    filterStatus,
    filterSpecialType,
    filterKey,
    filterDifficulty,
    filterYear,
    orgScope,
  ]);

  React.useEffect(() => {
    let cancelled = false;
    const filter = {
      page,
      page_size: pageSize,
      keyword: keyword || undefined,
      status: filterStatus || undefined,
      special_type: filterSpecialType || undefined,
      is_key_group: filterKey === "" ? undefined : filterKey === "true",
      difficulty_level: filterDifficulty || undefined,
      year: filterYear ? Number(filterYear) : undefined,
      ...orgScopeParams(orgScope),
    };
    void (async () => {
      try {
        const res = isTodo
          ? await reviewApi.todo(filter)
          : await reviewApi.records({ ...filter, tab });
        if (cancelled) return;
        setList(res.items);
        setTotal(res.total);
        setSelected(new Set());
        setError(null);
        setListSnapshotKey(listQueryKey);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "加载失败");
        setListSnapshotKey(listQueryKey);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listQueryKey, isTodo, tab, page, pageSize, keyword, filterStatus, filterSpecialType, filterKey, filterDifficulty, filterYear, orgScope]);

  React.useEffect(() => {
    let cancelled = false;
    const base = {
      page: 1,
      page_size: 1,
      keyword: keyword || undefined,
      special_type: filterSpecialType || undefined,
      is_key_group: filterKey === "" ? undefined : filterKey === "true",
      difficulty_level: filterDifficulty || undefined,
      year: filterYear ? Number(filterYear) : undefined,
      ...orgScopeParams(orgScope),
    };
    void (async () => {
      try {
        const [todoRes, doneRes, allRes] = await Promise.all([
          reviewApi.todo(base),
          reviewApi.records({ ...base, tab: "done" }),
          reviewApi.records({ ...base, tab: "all" }),
        ]);
        if (cancelled) return;
        setTabCounts({
          todo: todoRes.total,
          done: doneRes.total,
          all: allRes.total,
        });
      } catch {
        if (cancelled) return;
        setTabCounts({ todo: 0, done: 0, all: 0 });
      } finally {
        if (!cancelled) setCountsSnapshotKey(countsFilterKey);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countsFilterKey, keyword, filterSpecialType, filterKey, filterDifficulty, filterYear, orgScope]);

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
    const ids = Array.from(selected);
    if (ids.length === 0 && isTodo && total === 0) {
      toast.info("暂无本级待审记录");
      return;
    }
    setExportingSummary(true);
    try {
      await recognitionApi.exportSummary({
        keyword: keyword || undefined,
        year: filterYear ? Number(filterYear) : undefined,
        special_type: filterSpecialType || undefined,
        is_key_group: filterKey === "" ? undefined : filterKey === "true",
        difficulty_level: filterDifficulty || undefined,
        status: filterStatus || undefined,
        ids: ids.length ? ids : undefined,
        scope: ids.length ? undefined : isTodo ? "todo" : "approved",
        ...orgScopeParams(orgScope),
      });
      toast.success(
        ids.length
          ? `已导出选中的 ${ids.length} 条`
          : isTodo
            ? "本级待审名单已导出"
            : "认定结果汇总表已导出",
      );
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
        toast.success(
          `批量${batchDialog === "pass" ? "通过" : "退回"}成功，共 ${res.success} 条`,
        );
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
    checkboxColumn<RecognitionListItem>(
      selected,
      allSelected,
      toggleAll,
      toggleRow,
      (r) => r.id,
      (r) => r.student_name || String(r.id),
    ),
    {
      header: "姓名",
      width: "88px",
      cell: (r) => (
        <CellText className="font-medium text-ink">
          {r.student_name || "—"}
        </CellText>
      ),
    },
    {
      header: "学号",
      width: "140px",
      cell: (r) => (
        <CellText className="font-mono">{r.student_no || "—"}</CellText>
      ),
    },
    {
      header: "专业",
      width: "220px",
      cell: (r) => <CellText>{r.major_name || "—"}</CellText>,
    },
    ...(!isTodo
      ? [
          {
            header: "院系",
            width: "180px",
            cell: (r: RecognitionListItem) => (
              <CellText>{r.dept_name || "—"}</CellText>
            ),
          } satisfies Column<RecognitionListItem>,
        ]
      : []),
    {
      header: "班级",
      width: "200px",
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
    {
      header: "重点人群",
      width: "96px",
      cell: (r) =>
        r.is_key_group ? (
          <Badge tone="warning">重点</Badge>
        ) : (
          <span className="text-ink-mute">否</span>
        ),
    },
    {
      header: "状态",
      width: "112px",
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      header: "当前级别",
      width: "96px",
      cell: (r) => (
        <span className="text-sm">{levelName(r.current_level)}</span>
      ),
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
      header: "证明材料",
      width: "112px",
      cell: (r) => (
        <ProofPreviewCell
          recognitionId={r.id}
          count={r.proof_count ?? 0}
          studentName={r.student_name}
        />
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
                void recognitionApi.exportPdf(r.id).catch((e) => {
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

      {activeTabHint && (
        <p className="mb-4 text-xs text-ink-mute">{activeTabHint}</p>
      )}

      <Toolbar>
        <ToolbarFilters>
          <ToolbarSearch
            value={keywordInput}
            onChange={setKeywordInput}
            onSubmit={submitSearch}
            placeholder="姓名 / 学号"
            widthClassName="w-36"
          />
          <OrgScopeFilters
            value={orgScope}
            onChange={(next) => {
              setOrgScope(next);
              setPage(1);
            }}
          />
          <Select
            compact
            fitContent
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{isTodo ? "全部待办" : "全部状态"}</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            compact
            fitContent
            value={filterSpecialType}
            onChange={(e) => {
              setFilterSpecialType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部特殊群体</option>
            {SPECIAL_GROUP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            compact
            fitContent
            value={filterKey}
            onChange={(e) => {
              setFilterKey(e.target.value as KeyFilter);
              setPage(1);
            }}
          >
            <option value="">全部人群</option>
            <option value="true">仅重点人群</option>
            <option value="false">非重点人群</option>
          </Select>
          <Select
            compact
            fitContent
            value={filterDifficulty}
            onChange={(e) => {
              setFilterDifficulty(e.target.value);
              setPage(1);
            }}
          >
            <option value="">困难等级</option>
            {DIFFICULTY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            <option value="none">未评定</option>
          </Select>
          <Input
            compact
            value={yearInput}
            onChange={(e) => setYearInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && submitSearch()}
            placeholder="年度"
            className="w-20 shrink-0"
          />
          <Button variant="outline" size="sm" className="shrink-0" onClick={submitSearch}>
            查询
          </Button>
        </ToolbarFilters>
        {canExportSummary && (
          <ToolbarActions>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={exportingSummary}
              onClick={() => void handleExportSummary()}
              title={
                selected.size > 0
                  ? "导出勾选的记录"
                  : isTodo
                    ? "导出当前筛选下本级待审申请"
                    : "导出当前筛选范围内已认定通过的学生汇总表"
              }
            >
              <Download size={14} />
              {exportingSummary
                ? "导出中…"
                : selected.size > 0
                  ? `导出已选（${selected.size}）`
                  : isTodo
                    ? "导出本级待审"
                    : "导出已通过"}
            </Button>
          </ToolbarActions>
        )}
      </Toolbar>

      {selected.size > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-3 rounded-md px-4 py-2.5"
          style={{ backgroundColor: "var(--color-primary-subtle)" }}
        >
          <span className="text-sm text-ink">已选择 {selected.size} 条</span>
          <div className="flex items-center gap-1.5">
            {isTodo && (
              <>
                <Button size="sm" onClick={() => setBatchDialog("pass")}>
                  <Check size={14} />
                  批量通过
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setBatchDialog("reject")}
                >
                  <Undo2 size={14} />
                  批量退回
                </Button>
              </>
            )}
            {canExportSummary && (
              <Button
                size="sm"
                variant="outline"
                disabled={exportingSummary}
                onClick={() => void handleExportSummary()}
              >
                <Download size={14} />
                {exportingSummary ? "导出中…" : "导出已选"}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              取消选择
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={list}
        rowKey={(r) => r.id}
        pinStartCount={2}
        pinEndCount={2}
        loading={loading}
        error={error}
        onRetry={() => {
          setListSnapshotKey(null);
          void load();
        }}
        emptyLabel={
          tab === "todo"
            ? "暂无待办申请"
            : tab === "done"
              ? "暂无已办理记录"
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
