"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import { gradeApi, ApiError } from "@/lib/api";
import type { Grade } from "@/types/org";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toolbar } from "@/components/base-data/toolbar";
import { DataTable, type Column } from "@/components/base-data/data-table";
import { RowActions } from "@/components/base-data/row-actions";
import { BatchDeleteButton, checkboxColumn } from "@/components/base-data/batch-delete-button";
import { useRowSelection } from "@/hooks/use-row-selection";
import { OrgSpreadsheetActions } from "@/components/base-data/org-spreadsheet-actions";

export default function GradesPage() {
  const canWrite = useAuthStore((s) => s.user?.role === "admin");

  const [list, setList] = React.useState<Grade[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [keyword, setKeyword] = React.useState("");

  const [editing, setEditing] = React.useState<Grade | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [year, setYear] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<Grade | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const filtered = list.filter(
    (g) => g.name.includes(keyword) || String(g.year).includes(keyword),
  );

  const { selected, toggleRow, toggleAll, allSelected, clearSelection } = useRowSelection(filtered, (g) => g.id);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setList(await gradeApi.list());
      clearSelection();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [clearSelection]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setYear(String(new Date().getFullYear()));
    setFormOpen(true);
  };

  const openEdit = (g: Grade) => {
    setEditing(g);
    setName(g.name);
    setYear(String(g.year));
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    const yearNum = Number(year);
    if (!name.trim()) {
      toast.error("请填写年级名称");
      return;
    }
    if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 9999) {
      toast.error("请填写有效的年份");
      return;
    }
    setSubmitting(true);
    try {
      const body = { name: name.trim(), year: yearNum };
      if (editing) {
        await gradeApi.update(editing.id, body);
        toast.success("已更新年级");
      } else {
        await gradeApi.create(body);
        toast.success("已新增年级");
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
      await gradeApi.remove(deleteTarget.id);
      toast.success("已删除年级");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Grade>[] = [
    ...(canWrite
      ? [checkboxColumn<Grade>(selected, allSelected, toggleAll, toggleRow, (g) => g.id, (g) => g.name)]
      : []),
    { header: "ID", width: "80px", cell: (g) => <span className="text-ink-mute tabular-nums">{g.id}</span> },
    { header: "年级名称", cell: (g) => <span className="text-ink">{g.name}</span> },
    { header: "年份", cell: (g) => <span className="tabular-nums">{g.year}</span> },
    {
      header: "操作",
      width: "140px",
      cell: (g) => (
        <RowActions canWrite={canWrite} onEdit={() => openEdit(g)} onDelete={() => setDeleteTarget(g)} />
      ),
    },
  ];

  return (
    <div>
      <Toolbar>
        <div className="relative min-w-0 flex-1" style={{ maxWidth: 280 }}>
          <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-mute" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索年级名称或年份…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        {canWrite && (
          <>
            <BatchDeleteButton
              selectedIds={selected}
              deleteOne={(id) => gradeApi.remove(id)}
              onDone={load}
              entityLabel="年级"
              canWrite={canWrite}
              hint={`确定删除选中的 ${selected.size} 个年级吗？若其下存在班级将无法删除，将自动跳过。此操作不可撤销。`}
            />
            <OrgSpreadsheetActions
              kind="grades"
              importTitle="导入年级"
              importHint="按模板填写：年级名称、入学年份。相同入学年份将更新年级名称（增量 upsert）。"
              onDone={load}
            />
            <Button size="sm" onClick={openCreate}>
              <Plus size={16} />
              新增年级
            </Button>
          </>
        )}
      </Toolbar>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(g) => g.id}
        loading={loading}
        error={error}
        onRetry={load}
        emptyLabel={keyword ? "无匹配年级" : "暂无年级，点击右上角新增"}
      />

      <Modal
        open={formOpen}
        title={editing ? "编辑年级" : "新增年级"}
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
          <div>
            <Label htmlFor="grade-name">年级名称 *</Label>
            <Input id="grade-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：2024级" />
          </div>
          <div>
            <Label htmlFor="grade-year">年份 *</Label>
            <Input id="grade-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="如：2024" />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除年级"
        description={`确定删除年级「${deleteTarget?.name}」吗？若其下存在班级将无法删除。`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
