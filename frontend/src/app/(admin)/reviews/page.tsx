"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, Check, Undo2, Download } from "lucide-react";
import { reviewApi, recognitionApi, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterCombobox } from "@/components/ui/filter-combobox";
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
  canExportRecognitionApplications,
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
}[] = [
  { value: "todo", label: "待办" },
  { value: "done", label: "已办理" },
  { value: "all", label: "全部" },
];

function CountNum({ value, loading }: { value: number; loading: boolean }) {
  return (
    <strong className="mx-0.5 text-base font-semibold tabular-nums text-brand">
      {loading ? "—" : value.toLocaleString()}
    </strong>
  );
}

function parseTab(v: string | null): ReviewTab {
  if (v === "todo" || v === "done" || v === "all") return v;
  return "todo";
}

function positiveParam(v: string | null): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
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
  const [filterStatus, setFilterStatus] = React.useState(
    () => searchParams.get("status") ?? "",
  );
  const [filterSpecialType, setFilterSpecialType] = React.useState("");
  const [filterKey, setFilterKey] = React.useState<KeyFilter>("");
  const [filterDifficulty, setFilterDifficulty] = React.useState("");
  const [yearInput, setYearInput] = React.useState(
    () => searchParams.get("year") ?? "",
  );
  const [filterYear, setFilterYear] = React.useState(
    () => searchParams.get("year") ?? "",
  );
  const [orgScope, setOrgScope] = React.useState<OrgScopeValue>({
    deptId: positiveParam(searchParams.get("dept_id")),
    classId: positiveParam(searchParams.get("class_id")),
  });
  const [exportingSummary, setExportingSummary] = React.useState(false);
  const [exportingApplications, setExportingApplications] = React.useState(false);
  const canExportSummary = canExportRecognitionSummary(role);
  const canExportApplications = canExportRecognitionApplications(role);
  const applicationExportFiltered =
    tab !== "all" ||
    Boolean(
      keyword ||
        filterYear ||
        filterStatus ||
        filterSpecialType ||
        filterKey ||
        filterDifficulty ||
        orgScope.deptId ||
        orgScope.classId,
    );

  const [tabCounts, setTabCounts] = React.useState<Record<ReviewTab, number>>({
    todo: 0,
    done: 0,
    all: 0,
  });
  const [statusCounts, setStatusCounts] = React.useState({
    total: 0,
    pendingClass: 0,
    pendingDept: 0,
    pendingCollege: 0,
    rejected: 0,
    approved: 0,
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
        const [todoRes, doneRes, allRes, classRes, deptRes, collegeRes, finalRes, rejectedRes, approvedRes] =
          await Promise.all([
            reviewApi.todo(base),
            reviewApi.records({ ...base, tab: "done" }),
            reviewApi.records({ ...base, tab: "all" }),
            reviewApi.records({ ...base, tab: "all", status: "pending_class" }),
            reviewApi.records({ ...base, tab: "all", status: "pending_dept" }),
            reviewApi.records({ ...base, tab: "all", status: "pending_college" }),
            reviewApi.records({ ...base, tab: "all", status: "pending_final" }),
            reviewApi.records({ ...base, tab: "all", status: "rejected" }),
            reviewApi.records({ ...base, tab: "all", status: "approved" }),
          ]);
        if (cancelled) return;
        setTabCounts({
          todo: todoRes.total,
          done: doneRes.total,
          all: allRes.total,
        });
        setStatusCounts({
          total: allRes.total,
          pendingClass: classRes.total,
          pendingDept: deptRes.total,
          pendingCollege: collegeRes.total + finalRes.total,
          rejected: rejectedRes.total,
          approved: approvedRes.total,
        });
      } catch {
        if (cancelled) return;
        setTabCounts({ todo: 0, done: 0, all: 0 });
        setStatusCounts({
          total: 0,
          pendingClass: 0,
          pendingDept: 0,
          pendingCollege: 0,
          rejected: 0,
          approved: 0,
        });
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

  const handleExportSummary = async (onlySelected = false) => {
    const ids = onlySelected ? Array.from(selected) : [];
    if (onlySelected && ids.length === 0) return;
    if (!onlySelected && isTodo && total === 0) {
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
        status: onlySelected ? undefined : filterStatus || undefined,
        ids: ids.length ? ids : undefined,
        scope: onlySelected ? undefined : isTodo ? "todo" : "approved",
        ...orgScopeParams(orgScope),
      });
      toast.success(
        onlySelected
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

  const handleExportApplications = async (onlySelected = false) => {
    const ids = onlySelected ? Array.from(selected) : [];
    if (onlySelected && ids.length === 0) return;
    setExportingApplications(true);
    try {
      await recognitionApi.exportApplications({
        keyword: keyword || undefined,
        year: filterYear ? Number(filterYear) : undefined,
        special_type: filterSpecialType || undefined,
        is_key_group: filterKey === "" ? undefined : filterKey === "true",
        difficulty_level: filterDifficulty || undefined,
        status: onlySelected ? undefined : filterStatus || undefined,
        ids: ids.length ? ids : undefined,
        scope: onlySelected ? undefined : tab,
        ...orgScopeParams(orgScope),
      });
      toast.success(
        onlySelected
          ? `已导出选中的 ${ids.length} 份申请`
          : "筛选结果已导出",
      );
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "导出失败");
    } finally {
      setExportingApplications(false);
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
      header: "状态",
      width: "112px",
      cell: (r) => <StatusBadge status={r.status} />,
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

  const activeTabLabel = TAB_ITEMS.find((t) => t.value === tab)?.label ?? "";

  return (
    <div>
      <StatTabBar
        items={TAB_ITEMS.map((item) => ({
          value: item.value,
          label: item.label,
          count: tabCounts[item.value],
        }))}
        active={tab}
        onChange={(v) => setTab(v as ReviewTab)}
        loading={countsLoading}
      />

      <p
        className="mb-4 px-4 py-3 text-sm leading-7 text-ink"
        style={{
          backgroundColor: "var(--color-primary-subtle)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <span className="mr-2 font-semibold text-brand">{activeTabLabel}</span>
        {tab === "todo" ? (
          <>
            当前正在处理本级待审，共
            <CountNum value={tabCounts.todo} loading={countsLoading} />
            条，可逐条审核、勾选后批量通过或退回。
          </>
        ) : tab === "done" ? (
          <>
            当前查看你已审核过的记录，共
            <CountNum value={tabCounts.done} loading={countsLoading} />
            条。
          </>
        ) : (
          <>
            当前查看全部已提交申请。提交申请总人数
            <CountNum value={statusCounts.total} loading={countsLoading} />
            人，其中待班级审核
            <CountNum value={statusCounts.pendingClass} loading={countsLoading} />
            人，系级审核
            <CountNum value={statusCounts.pendingDept} loading={countsLoading} />
            人，院级审核
            <CountNum value={statusCounts.pendingCollege} loading={countsLoading} />
            人，退回
            <CountNum value={statusCounts.rejected} loading={countsLoading} />
            人，通过
            <CountNum value={statusCounts.approved} loading={countsLoading} />
            人。
          </>
        )}
      </p>

      <Toolbar>
        <ToolbarFilters className="flex-wrap overflow-visible">
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
          <Button variant="outline" size="sm" className="shrink-0" onClick={submitSearch}>
            查询
          </Button>
        </ToolbarFilters>
        <ToolbarFilters className="flex-wrap overflow-visible">
          <FilterCombobox
            value={filterStatus}
            placeholder={isTodo ? "全部待办" : "全部状态"}
            options={statusOptions}
            onValueChange={(next) => {
              setFilterStatus(next);
              setPage(1);
            }}
          />
          <FilterCombobox
            value={filterSpecialType}
            placeholder="全部特殊群体"
            options={SPECIAL_GROUP_OPTIONS}
            onValueChange={(next) => {
              setFilterSpecialType(next);
              setPage(1);
            }}
          />
          <FilterCombobox
            value={filterKey}
            placeholder="全部人群"
            options={[
              { value: "true", label: "仅重点人群" },
              { value: "false", label: "非重点人群" },
            ]}
            onValueChange={(next) => {
              setFilterKey(next as KeyFilter);
              setPage(1);
            }}
          />
          <FilterCombobox
            value={filterDifficulty}
            placeholder="困难等级"
            options={[
              ...DIFFICULTY_OPTIONS,
              { value: "none", label: "未评定" },
            ]}
            onValueChange={(next) => {
              setFilterDifficulty(next);
              setPage(1);
            }}
          />
          <Input
            compact
            value={yearInput}
            onChange={(e) => setYearInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && submitSearch()}
            placeholder="年度"
            className="w-20 shrink-0"
          />
        </ToolbarFilters>
        <ToolbarActions className="flex-nowrap overflow-x-auto">
          <span className="shrink-0 text-sm text-ink">已选择 {selected.size} 条</span>
          {isTodo && (
            <>
              <Button
                size="sm"
                className="shrink-0"
                disabled={selected.size === 0 || batching}
                onClick={() => setBatchDialog("pass")}
              >
                <Check size={14} />
                批量通过
              </Button>
              <Button
                size="sm"
                variant="danger"
                className="shrink-0"
                disabled={selected.size === 0 || batching}
                onClick={() => setBatchDialog("reject")}
              >
                <Undo2 size={14} />
                批量退回
              </Button>
            </>
          )}
          {canExportSummary && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={exportingSummary}
              onClick={() => void handleExportSummary(false)}
              title={
                isTodo
                  ? "导出当前筛选下本级待审申请"
                  : "导出当前筛选范围内已认定通过的学生汇总表"
              }
            >
              <Download size={14} />
              {exportingSummary
                ? "导出中…"
                : isTodo
                  ? "导出本级待审"
                  : "导出已通过"}
            </Button>
          )}
          {canExportApplications && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={exportingApplications}
                onClick={() => void handleExportApplications(false)}
                title="导出当前页签和筛选条件下的申请明细（不含草稿，含全部页）"
              >
                <Download size={14} />
                {exportingApplications
                  ? "导出中…"
                  : applicationExportFiltered
                    ? "导出筛选"
                    : "导出全部申请"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={selected.size === 0 || exportingApplications}
                onClick={() => void handleExportApplications(true)}
              >
                <Download size={14} />
                {exportingApplications ? "导出中…" : "导出已选申请"}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0"
            disabled={selected.size === 0}
            onClick={() => setSelected(new Set())}
          >
            取消选择
          </Button>
          {canExportSummary && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={selected.size === 0 || exportingSummary}
              onClick={() => void handleExportSummary(true)}
            >
              <Download size={14} />
              {exportingSummary ? "导出中…" : "导出已选的认定汇总表"}
            </Button>
          )}
        </ToolbarActions>
      </Toolbar>

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
