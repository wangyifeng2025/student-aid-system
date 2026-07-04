"use client";

import * as React from "react";
import { Plus, Search, Upload } from "lucide-react";
import { specialGroupApi, dictApi, ApiError } from "@/lib/api";
import type { SpecialGroup, SpecialGroupInput } from "@/types/student";
import type { DictItem } from "@/types/dict";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toolbar } from "@/components/base-data/toolbar";
import { DataTable, type Column } from "@/components/base-data/data-table";
import { RowActions } from "@/components/base-data/row-actions";
import { Pagination } from "@/components/base-data/pagination";
import { BatchDeleteButton, checkboxColumn } from "@/components/base-data/batch-delete-button";
import { useRowSelection } from "@/hooks/use-row-selection";
import { ImportDialog } from "@/components/student/import-dialog";

const DEFAULT_PAGE_SIZE = 20;

export default function SpecialGroupsPage() {
  const canWrite = useAuthStore((s) => s.user?.role === "admin");

  const [list, setList] = React.useState<SpecialGroup[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [keywordInput, setKeywordInput] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [filterType, setFilterType] = React.useState("");
  const [yearInput, setYearInput] = React.useState("");
  const [filterYear, setFilterYear] = React.useState("");

  const [types, setTypes] = React.useState<DictItem[]>([]);

  const [editing, setEditing] = React.useState<SpecialGroup | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState<SpecialGroupInput>(emptyForm());

  const [deleteTarget, setDeleteTarget] = React.useState<SpecialGroup | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  const { selected, toggleRow, toggleAll, allSelected, clearSelection } = useRowSelection(list, (s) => s.id);

  function emptyForm(): SpecialGroupInput {
    return {
      student_no: "",
      id_card: "",
      name: "",
      type: "",
      source: "",
      batch: "",
      year: undefined,
    };
  }

  const typeLabel = React.useCallback(
    (code: string) => types.find((t) => t.code === code)?.label ?? code,
    [types],
  );

  // 首屏加载特殊群体类型字典
  React.useEffect(() => {
    dictApi
      .listByType("special_group_type")
      .then(setTypes)
      .catch(() => setTypes([]));
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await specialGroupApi.list({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        type: filterType || undefined,
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
  }, [page, pageSize, keyword, filterType, filterYear, clearSelection]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const resetToFirst = () => setPage(1);
  const submitSearch = () => {
    setKeyword(keywordInput.trim());
    setFilterYear(yearInput);
    resetToFirst();
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const setField = <K extends keyof SpecialGroupInput>(
    key: K,
    value: SpecialGroupInput[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (s: SpecialGroup) => {
    setEditing(s);
    setForm({
      student_no: s.student_no,
      id_card: s.id_card,
      name: s.name,
      type: s.type,
      source: s.source,
      batch: s.batch,
      year: s.year || undefined,
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.type) {
      toast.error("请选择类型");
      return;
    }
    if (!form.student_no?.trim() && !form.id_card?.trim()) {
      toast.error("学号与身份证号至少填写一个");
      return;
    }
    setSubmitting(true);
    try {
      const body: SpecialGroupInput = {
        ...form,
        student_no: form.student_no?.trim() || undefined,
        id_card: form.id_card?.trim() || undefined,
        name: form.name?.trim() || undefined,
      };
      if (editing) {
        await specialGroupApi.update(editing.id, body);
        toast.success("已更新名单记录");
      } else {
        await specialGroupApi.create(body);
        toast.success("已新增名单记录");
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await specialGroupApi.remove(deleteTarget.id);
      toast.success("已删除名单记录");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<SpecialGroup>[] = [
    ...(canWrite
      ? [checkboxColumn(selected, allSelected, toggleAll, toggleRow, (s) => s.id, (s) => s.name || s.student_no || String(s.id))]
      : []),
    { header: "姓名", width: "100px", cell: (s) => <span className="text-ink">{s.name || "—"}</span> },
    { header: "学号", cell: (s) => <span className="font-mono">{s.student_no || "—"}</span> },
    { header: "身份证号", cell: (s) => <span className="font-mono text-ink-soft">{s.id_card || "—"}</span> },
    { header: "类型", cell: (s) => <Badge tone="brand">{typeLabel(s.type)}</Badge> },
    { header: "来源", width: "120px", cell: (s) => s.source || "—" },
    { header: "年度", width: "80px", cell: (s) => <span className="tabular-nums">{s.year || "—"}</span> },
    {
      header: "操作",
      width: "120px",
      cell: (s) => (
        <RowActions canWrite={canWrite} onEdit={() => openEdit(s)} onDelete={() => setDeleteTarget(s)} />
      ),
    },
  ];

  return (
    <div>
      <Toolbar>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-0" style={{ width: 240 }}>
            <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-mute" />
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSearch()}
              placeholder="搜索姓名/学号/身份证…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              resetToFirst();
            }}
          >
            <option value="">全部类型</option>
            {types.map((t) => (
              <option key={t.code} value={t.code}>{t.label}</option>
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
        {canWrite && (
          <div className="flex items-center gap-2">
            <BatchDeleteButton
              selectedIds={selected}
              deleteOne={(id) => specialGroupApi.remove(id)}
              onDone={load}
              entityLabel="名单记录"
              canWrite={canWrite}
              hint={`确定删除选中的 ${selected.size} 条名单记录吗？删除后将重算关联学生的重点人群标记，此操作不可撤销。`}
            />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload size={16} />
              导入名单
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus size={16} />
              新增记录
            </Button>
          </div>
        )}
      </Toolbar>

      <DataTable
        columns={columns}
        data={list}
        rowKey={(s) => s.id}
        loading={loading}
        error={error}
        onRetry={load}
        emptyLabel={keyword || filterType || filterYear ? "无匹配记录" : "暂无名单记录，可新增或导入"}
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

      <Modal
        open={formOpen}
        title={editing ? "编辑名单记录" : "新增名单记录"}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "保存中…" : "保存"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="rounded-md bg-page px-3 py-2 text-xs text-ink-mute">
            学号与身份证号至少填写一个，用于与学生自动匹配（命中后学生将标记为重点人群）。
          </p>
          <div>
            <Label htmlFor="sg-type">类型 *</Label>
            <Select id="sg-type" className="w-full" value={form.type} onChange={(e) => setField("type", e.target.value)}>
              <option value="">请选择类型</option>
              {types.map((t) => (
                <option key={t.code} value={t.code}>{t.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="sg-name">姓名</Label>
            <Input id="sg-name" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="姓名（便于核对）" />
          </div>
          <div>
            <Label htmlFor="sg-no">学号</Label>
            <Input id="sg-no" value={form.student_no} onChange={(e) => setField("student_no", e.target.value)} placeholder="如：2024010101" />
          </div>
          <div>
            <Label htmlFor="sg-idcard">身份证号</Label>
            <Input id="sg-idcard" value={form.id_card} onChange={(e) => setField("id_card", e.target.value)} placeholder="18 位居民身份证" />
          </div>
          <div>
            <Label htmlFor="sg-source">来源</Label>
            <Input id="sg-source" value={form.source} onChange={(e) => setField("source", e.target.value)} placeholder="如：民政局 / 乡村振兴局" />
          </div>
          <div>
            <Label htmlFor="sg-batch">批次</Label>
            <Input id="sg-batch" value={form.batch} onChange={(e) => setField("batch", e.target.value)} placeholder="如：2024秋" />
          </div>
          <div>
            <Label htmlFor="sg-year">年度</Label>
            <Input
              id="sg-year"
              type="number"
              value={form.year ?? ""}
              onChange={(e) => setField("year", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="如：2024"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除名单记录"
        description={`确定删除「${deleteTarget?.name || deleteTarget?.student_no || deleteTarget?.id_card}」的记录吗？删除后将重算关联学生的重点人群标记。`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ImportDialog
        open={importOpen}
        kind="special-groups"
        title="导入重点保障人群名单"
        hint="按模板列填写：学号、身份证号、姓名、类型(编码)、来源、批次、年度。相同身份+类型+年度的记录将自动跳过（幂等）。导入后会自动匹配并标记对应学生。"
        onClose={() => setImportOpen(false)}
        onImported={load}
      />
    </div>
  );
}
