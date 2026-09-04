"use client";

import * as React from "react";
import { Plus, Search, Upload, Download } from "lucide-react";
import { advisorApi, departmentApi, classApi, exportApi, ApiError } from "@/lib/api";
import type { Advisor, AdvisorInput } from "@/types/advisor";
import type { Class, Department } from "@/types/org";
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
import { Pagination } from "@/components/base-data/pagination";
import { BatchDeleteButton, checkboxColumn } from "@/components/base-data/batch-delete-button";
import { useRowSelection } from "@/hooks/use-row-selection";
import { Combobox } from "@/components/ui/combobox";
import { ImportDialog } from "@/components/student/import-dialog";

const DEFAULT_PAGE_SIZE = 20;

export default function AdvisorsPage() {
  const canWrite = useAuthStore((s) => s.user?.role === "admin");

  const [list, setList] = React.useState<Advisor[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [keywordInput, setKeywordInput] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [filterDept, setFilterDept] = React.useState("");

  const [depts, setDepts] = React.useState<Department[]>([]);
  const [classes, setClasses] = React.useState<Class[]>([]);

  const [editing, setEditing] = React.useState<Advisor | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState<AdvisorInput>(emptyForm());

  const [deleteTarget, setDeleteTarget] = React.useState<Advisor | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const { selected, toggleRow, toggleAll, allSelected, clearSelection } = useRowSelection(list, (a) => a.id);

  function emptyForm(): AdvisorInput {
    return { dept_id: 0, staff_no: "", name: "", phone: "", class_ids: [] };
  }

  React.useEffect(() => {
    Promise.all([departmentApi.list(), classApi.list()])
      .then(([d, c]) => {
        setDepts(d);
        setClasses(c);
      })
      .catch(() => {
        setDepts([]);
        setClasses([]);
      });
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await advisorApi.list({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        dept_id: filterDept ? Number(filterDept) : undefined,
      });
      setList(res.items);
      setTotal(res.total);
      clearSelection();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, filterDept, clearSelection]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const submitSearch = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  const deptClasses = React.useMemo(
    () => (form.dept_id ? classes.filter((c) => c.dept_id === form.dept_id) : []),
    [classes, form.dept_id],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (a: Advisor) => {
    setEditing(a);
    setForm({
      dept_id: a.dept_id,
      staff_no: a.staff_no,
      name: a.name,
      phone: a.phone,
      class_ids: a.classes.map((c) => c.id),
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.dept_id) {
      toast.error("请选择系部");
      return;
    }
    if (!form.staff_no.trim()) {
      toast.error("请填写教工号");
      return;
    }
    if (!form.name.trim()) {
      toast.error("请填写姓名");
      return;
    }
    setSubmitting(true);
    try {
      const body: AdvisorInput = {
        dept_id: form.dept_id,
        staff_no: form.staff_no.trim(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        class_ids: form.class_ids,
      };
      if (editing) {
        await advisorApi.update(editing.id, body);
        toast.success("已更新班主任信息");
      } else {
        const created = await advisorApi.create(body);
        if (created.initial_password && created.username) {
          toast.success(`已新增。登录账号 ${created.username}，初始密码 ${created.initial_password}`);
        } else {
          toast.success("已新增班主任");
        }
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
      await advisorApi.remove(deleteTarget.id);
      toast.success("已删除班主任");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportApi.advisors();
      toast.success("已开始下载");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<Advisor>[] = [
    ...(canWrite
      ? [checkboxColumn<Advisor>(selected, allSelected, toggleAll, toggleRow, (a) => a.id, (a) => a.name)]
      : []),
    { header: "系部", width: "160px", cell: (a) => a.dept_name || "—" },
    { header: "教工号", width: "120px", cell: (a) => <span className="font-mono text-ink">{a.staff_no}</span> },
    { header: "姓名", width: "100px", cell: (a) => <span className="text-ink">{a.name}</span> },
    { header: "电话", width: "130px", cell: (a) => <span className="font-mono">{a.phone || "—"}</span> },
    {
      header: "管理班级",
      cell: (a) => (a.classes.length ? a.classes.map((c) => c.name).join("、") : "—"),
    },
    {
      header: "操作",
      width: "120px",
      cell: (a) => (
        <RowActions canWrite={canWrite} onEdit={() => openEdit(a)} onDelete={() => setDeleteTarget(a)} />
      ),
    },
  ];

  return (
    <div>
      <Toolbar>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-0" style={{ width: 220 }}>
            <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-mute" />
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSearch()}
              placeholder="搜索姓名/电话/教工号…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select
            value={filterDept}
            onChange={(e) => {
              setFilterDept(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部系部</option>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={submitSearch}>
            查询
          </Button>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <BatchDeleteButton
              selectedIds={selected}
              deleteOne={(id) => advisorApi.remove(id)}
              onDone={load}
              entityLabel="班主任"
              canWrite={canWrite}
              hint={`确定删除选中的 ${selected.size} 位班主任吗？将彻底删除其登录账号；已有评审记录的无法删除，将自动跳过。`}
            />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload size={16} />
              导入
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              <Download size={16} />
              {exporting ? "导出中…" : "导出"}
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus size={16} />
              新增
            </Button>
          </div>
        )}
      </Toolbar>

      <DataTable
        columns={columns}
        data={list}
        rowKey={(a) => a.id}
        loading={loading}
        error={error}
        onRetry={load}
        emptyLabel={keyword || filterDept ? "无匹配记录" : "暂无班主任，可新增或导入"}
      />

      {!loading && !error && total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}

      <Modal
        open={formOpen}
        title={editing ? "编辑班主任" : "新增班主任"}
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
            <Label>系部 *</Label>
            <Select
              value={form.dept_id ? String(form.dept_id) : ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  dept_id: Number(e.target.value) || 0,
                  class_ids: [],
                }))
              }
            >
              <option value="">请选择系部</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>教工号 *</Label>
            <Input
              value={form.staff_no}
              onChange={(e) => setForm((p) => ({ ...p, staff_no: e.target.value }))}
              placeholder="登录用户名，全校唯一"
            />
          </div>
          <div>
            <Label>姓名 *</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <Label>电话</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="11 位手机号"
            />
          </div>
          <div>
            <Label htmlFor="advisor-classes">管理班级（可多选）</Label>
            {!form.dept_id ? (
              <p className="mt-1 text-sm text-ink-mute">请先选择系部</p>
            ) : deptClasses.length === 0 ? (
              <p className="mt-1 text-sm text-ink-mute">该系部下暂无班级，请先在班级管理中创建</p>
            ) : (
              <Combobox
                multiple
                id="advisor-classes"
                className="mt-1 w-full"
                value={form.class_ids.map(String)}
                onChange={(ids) =>
                  setForm((p) => ({ ...p, class_ids: ids.map(Number) }))
                }
                placeholder="输入班级名称搜索，可多选"
                emptyText="无匹配班级"
                options={deptClasses.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                  keywords: c.name,
                }))}
              />
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除班主任"
        description={deleteTarget ? `确定删除「${deleteTarget.name}」？将彻底删除其登录账号；已有评审记录则无法删除。` : ""}
        confirmText="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ImportDialog
        open={importOpen}
        kind="advisors"
        title="导入班主任"
        hint="模板列为：系部、教工号*、姓名*、电话、班级名称、专业、年级。教工号为登录用户名。每次导入会把登录密码重置为 Adv＋手机号后 6 位（A 大写，如 19908596061 → Adv596061）；电话不足 6 位则为 Adv123456。"
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void classApi.list().then(setClasses).catch(() => undefined);
          void load();
        }}
      />
    </div>
  );
}
