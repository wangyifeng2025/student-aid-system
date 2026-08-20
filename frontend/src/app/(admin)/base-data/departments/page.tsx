"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import { departmentApi, ApiError } from "@/lib/api";
import type { Department } from "@/types/org";
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

export default function DepartmentsPage() {
  const canWrite = useAuthStore((s) => s.user?.role === "admin");

  const [list, setList] = React.useState<Department[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [keyword, setKeyword] = React.useState("");

  const [editing, setEditing] = React.useState<Department | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<Department | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const filtered = list.filter(
    (d) =>
      d.name.includes(keyword) ||
      d.code.toLowerCase().includes(keyword.toLowerCase()),
  );

  const { selected, toggleRow, toggleAll, allSelected, clearSelection } = useRowSelection(filtered, (d) => d.id);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setList(await departmentApi.list());
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
    setCode("");
    setFormOpen(true);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setName(d.name);
    setCode(d.code);
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("请填写院系名称");
      return;
    }
    setSubmitting(true);
    try {
      const body = { name: name.trim(), code: code.trim() };
      if (editing) {
        await departmentApi.update(editing.id, body);
        toast.success("已更新院系");
      } else {
        await departmentApi.create(body);
        toast.success("已新增院系");
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
      await departmentApi.remove(deleteTarget.id);
      toast.success("已删除院系");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Department>[] = [
    ...(canWrite
      ? [checkboxColumn<Department>(selected, allSelected, toggleAll, toggleRow, (d) => d.id, (d) => d.name)]
      : []),
    { header: "ID", width: "80px", cell: (d) => <span className="text-ink-mute tabular-nums">{d.id}</span> },
    { header: "院系名称", cell: (d) => <span className="text-ink">{d.name}</span> },
    { header: "院系编码", cell: (d) => (d.code ? <span className="font-mono">{d.code}</span> : <span className="text-ink-mute">—</span>) },
    {
      header: "操作",
      width: "140px",
      cell: (d) => (
        <RowActions
          canWrite={canWrite}
          onEdit={() => openEdit(d)}
          onDelete={() => setDeleteTarget(d)}
        />
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
            placeholder="搜索院系名称或编码…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        {canWrite && (
          <>
            <BatchDeleteButton
              selectedIds={selected}
              deleteOne={(id) => departmentApi.remove(id)}
              onDone={load}
              entityLabel="院系"
              canWrite={canWrite}
              hint={`确定删除选中的 ${selected.size} 个院系吗？若其下存在专业或班级将无法删除，将自动跳过。此操作不可撤销。`}
            />
            <OrgSpreadsheetActions
              kind="departments"
              importTitle="导入院系"
              importHint="按模板填写：院系名称、院系编码。编码相同的行将更新名称（增量 upsert）。"
              onDone={load}
            />
            <Button size="sm" onClick={openCreate}>
              <Plus size={16} />
              新增院系
            </Button>
          </>
        )}
      </Toolbar>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(d) => d.id}
        loading={loading}
        error={error}
        onRetry={load}
        emptyLabel={keyword ? "无匹配院系" : "暂无院系，点击右上角新增"}
      />

      <Modal
        open={formOpen}
        title={editing ? "编辑院系" : "新增院系"}
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
            <Label htmlFor="dept-name">院系名称 *</Label>
            <Input id="dept-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：信息工程学院" />
          </div>
          <div>
            <Label htmlFor="dept-code">院系编码</Label>
            <Input id="dept-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="如：CS（可选，非空则全局唯一）" />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除院系"
        description={`确定删除院系「${deleteTarget?.name}」吗？若其下存在专业或班级将无法删除。`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
