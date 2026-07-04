"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { dictApi, ApiError } from "@/lib/api";
import type { DictItem } from "@/types/dict";
import { dictTypeLabel } from "@/types/dict";
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

export default function DictsPage() {
  const canWrite = useAuthStore((s) => s.user?.role === "admin");

  const [types, setTypes] = React.useState<string[]>([]);
  const [selectedType, setSelectedType] = React.useState("");
  const [items, setItems] = React.useState<DictItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<DictItem | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [sort, setSort] = React.useState("0");
  const [submitting, setSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<DictItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // 首屏加载所有类型
  React.useEffect(() => {
    (async () => {
      try {
        const t = await dictApi.listTypes();
        setTypes(t);
        setSelectedType((prev) => prev || t[0] || "");
        if (t.length === 0) setLoading(false);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "加载字典类型失败");
        setLoading(false);
      }
    })();
  }, []);

  const loadItems = React.useCallback(async (type: string) => {
    if (!type) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await dictApi.listByType(type));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载字典项失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (selectedType) void loadItems(selectedType);
  }, [selectedType, loadItems]);

  const openCreate = () => {
    setEditing(null);
    setCode("");
    setLabel("");
    setSort(String(items.length));
    setFormOpen(true);
  };

  const openEdit = (it: DictItem) => {
    setEditing(it);
    setCode(it.code);
    setLabel(it.label);
    setSort(String(it.sort));
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!editing && !code.trim()) {
      toast.error("请填写编码 code");
      return;
    }
    if (!label.trim()) {
      toast.error("请填写显示文案 label");
      return;
    }
    const sortNum = Number(sort) || 0;
    setSubmitting(true);
    try {
      if (editing) {
        await dictApi.update(selectedType, editing.code, {
          label: label.trim(),
          sort: sortNum,
        });
        toast.success("已更新字典项");
      } else {
        await dictApi.create(selectedType, {
          code: code.trim(),
          label: label.trim(),
          sort: sortNum,
        });
        toast.success("已新增字典项");
      }
      setFormOpen(false);
      await loadItems(selectedType);
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
      await dictApi.remove(selectedType, deleteTarget.code);
      toast.success("已删除字典项");
      setDeleteTarget(null);
      await loadItems(selectedType);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<DictItem>[] = [
    { header: "排序", width: "80px", cell: (it) => <span className="text-ink-mute tabular-nums">{it.sort}</span> },
    { header: "编码 code", cell: (it) => <span className="font-mono">{it.code}</span> },
    { header: "显示文案 label", cell: (it) => <span className="text-ink">{it.label}</span> },
    {
      header: "操作",
      width: "140px",
      cell: (it) => (
        <RowActions canWrite={canWrite} onEdit={() => openEdit(it)} onDelete={() => setDeleteTarget(it)} />
      ),
    },
  ];

  return (
    <div>
      <Toolbar>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Label className="mb-0 shrink-0">字典类型</Label>
          <Select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
            {types.length === 0 && <option value="">暂无类型</option>}
            {types.map((t) => (
              <option key={t} value={t}>
                {dictTypeLabel(t)}（{t}）
              </option>
            ))}
          </Select>
        </div>
        {canWrite && selectedType && (
          <Button size="sm" onClick={openCreate}>
            <Plus size={16} />
            新增字典项
          </Button>
        )}
      </Toolbar>

      <DataTable
        columns={columns}
        data={items}
        rowKey={(it) => it.id}
        loading={loading}
        error={error}
        onRetry={() => loadItems(selectedType)}
        emptyLabel="该类型下暂无字典项"
      />

      <Modal
        open={formOpen}
        title={editing ? "编辑字典项" : "新增字典项"}
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
            <Label>所属类型</Label>
            <div className="rounded-md border border-line bg-page px-3 py-2 text-sm text-ink-soft">
              {dictTypeLabel(selectedType)}（{selectedType}）
            </div>
          </div>
          <div>
            <Label htmlFor="dict-code">编码 code *</Label>
            <Input
              id="dict-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="如：han（用于前后端交互，创建后不可改）"
              disabled={editing !== null}
            />
          </div>
          <div>
            <Label htmlFor="dict-label">显示文案 label *</Label>
            <Input id="dict-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="如：汉族" />
          </div>
          <div>
            <Label htmlFor="dict-sort">排序 sort</Label>
            <Input id="dict-sort" type="number" value={sort} onChange={(e) => setSort(e.target.value)} placeholder="数字越小越靠前" />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除字典项"
        description={`确定删除「${deleteTarget?.label}（${deleteTarget?.code}）」吗？`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
