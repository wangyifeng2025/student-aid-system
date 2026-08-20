"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import { majorApi, departmentApi, ApiError } from "@/lib/api";
import type { Department, Major } from "@/types/org";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toolbar } from "@/components/base-data/toolbar";
import { DataTable, type Column } from "@/components/base-data/data-table";
import { RowActions } from "@/components/base-data/row-actions";
import { BatchDeleteButton, checkboxColumn } from "@/components/base-data/batch-delete-button";
import { useRowSelection } from "@/hooks/use-row-selection";
import { OrgSpreadsheetActions } from "@/components/base-data/org-spreadsheet-actions";

export default function MajorsPage() {
  const canWrite = useAuthStore((s) => s.user?.role === "admin");

  const [list, setList] = React.useState<Major[]>([]);
  const [depts, setDepts] = React.useState<Department[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [keyword, setKeyword] = React.useState("");
  const [filterDept, setFilterDept] = React.useState("");

  const [editing, setEditing] = React.useState<Major | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [deptId, setDeptId] = React.useState("");
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<Major | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const deptName = React.useCallback(
    (id: number) => depts.find((d) => d.id === id)?.name ?? `#${id}`,
    [depts],
  );

  const filtered = list.filter((m) => {
    const matchKeyword =
      m.name.includes(keyword) ||
      m.code.toLowerCase().includes(keyword.toLowerCase());
    const matchDept = !filterDept || m.dept_id === Number(filterDept);
    return matchKeyword && matchDept;
  });

  const { selected, toggleRow, toggleAll, allSelected, clearSelection } = useRowSelection(filtered, (m) => m.id);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [majors, departments] = await Promise.all([
        majorApi.list(),
        departmentApi.list(),
      ]);
      setList(majors);
      setDepts(departments);
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
    setDeptId(filterDept || (depts[0] ? String(depts[0].id) : ""));
    setName("");
    setCode("");
    setFormOpen(true);
  };

  const openEdit = (m: Major) => {
    setEditing(m);
    setDeptId(String(m.dept_id));
    setName(m.name);
    setCode(m.code);
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!deptId) {
      toast.error("请选择所属院系");
      return;
    }
    if (!name.trim()) {
      toast.error("请填写专业名称");
      return;
    }
    setSubmitting(true);
    try {
      const body = { dept_id: Number(deptId), name: name.trim(), code: code.trim() };
      if (editing) {
        await majorApi.update(editing.id, body);
        toast.success("已更新专业");
      } else {
        await majorApi.create(body);
        toast.success("已新增专业");
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
      await majorApi.remove(deleteTarget.id);
      toast.success("已删除专业");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Major>[] = [
    ...(canWrite
      ? [checkboxColumn<Major>(selected, allSelected, toggleAll, toggleRow, (m) => m.id, (m) => m.name)]
      : []),
    { header: "ID", width: "80px", cell: (m) => <span className="text-ink-mute tabular-nums">{m.id}</span> },
    { header: "专业名称", cell: (m) => <span className="text-ink">{m.name}</span> },
    { header: "所属院系", cell: (m) => deptName(m.dept_id) },
    { header: "专业编码", cell: (m) => (m.code ? <span className="font-mono">{m.code}</span> : <span className="text-ink-mute">—</span>) },
    {
      header: "操作",
      width: "140px",
      cell: (m) => (
        <RowActions canWrite={canWrite} onEdit={() => openEdit(m)} onDelete={() => setDeleteTarget(m)} />
      ),
    },
  ];

  return (
    <div>
      <Toolbar>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative min-w-0 flex-1" style={{ maxWidth: 280 }}>
            <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-mute" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索专业名称或编码…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">全部院系</option>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </div>
        {canWrite && (
          <>
            <BatchDeleteButton
              selectedIds={selected}
              deleteOne={(id) => majorApi.remove(id)}
              onDone={load}
              entityLabel="专业"
              canWrite={canWrite}
              hint={`确定删除选中的 ${selected.size} 个专业吗？若其下存在班级将无法删除，将自动跳过。此操作不可撤销。`}
            />
            <OrgSpreadsheetActions
              kind="majors"
              importTitle="导入专业"
              importHint="按模板填写：院系编码、专业名称、专业编码。同一院系下编码相同则更新名称；编码留空则按名称匹配。"
              onDone={load}
            />
            <Button size="sm" onClick={openCreate}>
              <Plus size={16} />
              新增专业
            </Button>
          </>
        )}
      </Toolbar>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(m) => m.id}
        loading={loading}
        error={error}
        onRetry={load}
        emptyLabel={keyword || filterDept ? "无匹配专业" : "暂无专业，点击右上角新增"}
      />

      <Modal
        open={formOpen}
        title={editing ? "编辑专业" : "新增专业"}
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
            <Label htmlFor="major-dept">所属院系 *</Label>
            <Select id="major-dept" className="w-full" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
              <option value="">请选择院系</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="major-name">专业名称 *</Label>
            <Input id="major-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：软件工程" />
          </div>
          <div>
            <Label htmlFor="major-code">专业编码</Label>
            <Input id="major-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="如：SE（可选）" />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除专业"
        description={`确定删除专业「${deleteTarget?.name}」吗？若其下存在班级将无法删除。`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
