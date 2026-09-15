"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  classApi,
  departmentApi,
  majorApi,
  gradeApi,
  advisorApi,
  ApiError,
} from "@/lib/api";
import type { Class, Department, Major, Grade } from "@/types/org";
import type { Advisor } from "@/types/advisor";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toolbar, ToolbarActions, ToolbarFilters, ToolbarSearch } from "@/components/base-data/toolbar";
import { DataTable, type Column } from "@/components/base-data/data-table";
import { RowActions } from "@/components/base-data/row-actions";
import { Pagination } from "@/components/base-data/pagination";
import { BatchDeleteButton, checkboxColumn } from "@/components/base-data/batch-delete-button";
import { useRowSelection } from "@/hooks/use-row-selection";
import { OrgSpreadsheetActions } from "@/components/base-data/org-spreadsheet-actions";

const DEFAULT_PAGE_SIZE = 20;

export default function ClassesPage() {
  const canWrite = useAuthStore((s) => s.user?.role === "admin");

  const [list, setList] = React.useState<Class[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [depts, setDepts] = React.useState<Department[]>([]);
  const [majors, setMajors] = React.useState<Major[]>([]);
  const [grades, setGrades] = React.useState<Grade[]>([]);
  const [advisors, setAdvisors] = React.useState<Advisor[]>([]);
  const [advisorsLoading, setAdvisorsLoading] = React.useState(false);
  const [advisorsError, setAdvisorsError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [keywordInput, setKeywordInput] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [filterDept, setFilterDept] = React.useState("");

  const [editing, setEditing] = React.useState<Class | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [deptId, setDeptId] = React.useState("");
  const [majorId, setMajorId] = React.useState("");
  const [gradeId, setGradeId] = React.useState("");
  const [name, setName] = React.useState("");
  const [advisorStaffNo, setAdvisorStaffNo] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<Class | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const deptName = React.useCallback(
    (id: number) => depts.find((d) => d.id === id)?.name ?? `#${id}`,
    [depts],
  );
  const majorName = React.useCallback(
    (id?: number) => (id ? majors.find((m) => m.id === id)?.name ?? `#${id}` : "—"),
    [majors],
  );
  const gradeName = React.useCallback(
    (id?: number) => (id ? grades.find((g) => g.id === id)?.name ?? `#${id}` : "—"),
    [grades],
  );

  const { selected, toggleRow, toggleAll, allSelected, clearSelection } = useRowSelection(list, (c) => c.id);

  React.useEffect(() => {
    Promise.all([departmentApi.list(), majorApi.list(), gradeApi.list()])
      .then(([departments, allMajors, allGrades]) => {
        setDepts(departments);
        setMajors(allMajors);
        setGrades(allGrades);
      })
      .catch(() => {
        setDepts([]);
        setMajors([]);
        setGrades([]);
      });
  }, []);

  // 打开表单且选了院系后再拉该院系全部班主任，避免全校 page_size=100 截断。
  React.useEffect(() => {
    if (!formOpen || !deptId) {
      setAdvisors([]);
      setAdvisorsError(null);
      setAdvisorsLoading(false);
      return;
    }
    let cancelled = false;
    setAdvisorsLoading(true);
    setAdvisorsError(null);
    advisorApi
      .list({ dept_id: Number(deptId) })
      .then((res) => {
        if (!cancelled) setAdvisors(res.items ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setAdvisors([]);
        setAdvisorsError(e instanceof ApiError ? e.message : "加载班主任失败");
      })
      .finally(() => {
        if (!cancelled) setAdvisorsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formOpen, deptId]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await classApi.page({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        dept_id: filterDept ? Number(filterDept) : undefined,
      });
      setList(res.items ?? []);
      setTotal(res.total ?? 0);
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

  const resetToFirst = () => setPage(1);
  const submitSearch = () => {
    setKeyword(keywordInput.trim());
    resetToFirst();
  };
  const handlePageChange = (next: number) => setPage(next);
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  // 表单内专业按所选院系联动；班主任已按院系从接口拉取
  const formMajors = deptId
    ? majors.filter((m) => m.dept_id === Number(deptId))
    : majors;

  const openCreate = () => {
    setEditing(null);
    setDeptId(filterDept || (depts[0] ? String(depts[0].id) : ""));
    setMajorId("");
    setGradeId("");
    setName("");
    setAdvisorStaffNo("");
    setFormOpen(true);
  };

  const openEdit = (c: Class) => {
    setEditing(c);
    setDeptId(String(c.dept_id));
    setMajorId(c.major_id ? String(c.major_id) : "");
    setGradeId(c.grade_id ? String(c.grade_id) : "");
    setName(c.name);
    setAdvisorStaffNo(c.staff_no ?? "");
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!deptId) {
      toast.error("请选择所属院系");
      return;
    }
    if (!name.trim()) {
      toast.error("请填写班级名称");
      return;
    }
    if (!advisorStaffNo.trim()) {
      toast.error("请选择班主任（请先维护班主任信息）");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        dept_id: Number(deptId),
        major_id: majorId ? Number(majorId) : undefined,
        grade_id: gradeId ? Number(gradeId) : undefined,
        name: name.trim(),
        staff_no: advisorStaffNo.trim(),
      };
      if (editing) {
        await classApi.update(editing.id, body);
        toast.success("已更新班级");
      } else {
        await classApi.create(body);
        toast.success("已新增班级");
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
      await classApi.remove(deleteTarget.id);
      toast.success("已删除班级");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Class>[] = [
    ...(canWrite
      ? [checkboxColumn<Class>(selected, allSelected, toggleAll, toggleRow, (c) => c.id, (c) => c.name)]
      : []),
    { header: "ID", width: "80px", cell: (c) => <span className="text-ink-mute tabular-nums">{c.id}</span> },
    { header: "班级名称", width: "240px", cell: (c) => <span className="text-ink">{c.name}</span> },
    { header: "院系", width: "160px", cell: (c) => deptName(c.dept_id) },
    { header: "专业", width: "160px", cell: (c) => majorName(c.major_id) },
    { header: "年级", cell: (c) => gradeName(c.grade_id) },
    { header: "班主任", width: "100px", cell: (c) => c.advisor_name || "—" },
    { header: "教工号", width: "120px", cell: (c) => <span className="font-mono">{c.staff_no || "—"}</span> },
    { header: "电话", width: "130px", cell: (c) => <span className="font-mono">{c.advisor_phone || "—"}</span> },
    {
      header: "操作",
      width: "140px",
      cell: (c) => (
        <RowActions canWrite={canWrite} onEdit={() => openEdit(c)} onDelete={() => setDeleteTarget(c)} />
      ),
    },
  ];

  return (
    <div>
      <Toolbar>
        <ToolbarFilters>
          <ToolbarSearch
            value={keywordInput}
            onChange={setKeywordInput}
            onSubmit={submitSearch}
            placeholder="班级 / 班主任 / 教工号"
            widthClassName="w-52"
          />
          <Select
            compact
            value={filterDept}
            onChange={(e) => {
              setFilterDept(e.target.value);
              resetToFirst();
            }}
            className="w-28 shrink-0"
          >
            <option value="">全部院系</option>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
          <Button variant="outline" size="sm" className="shrink-0" onClick={submitSearch}>
            查询
          </Button>
        </ToolbarFilters>
        {canWrite && (
          <ToolbarActions>
            <BatchDeleteButton
              selectedIds={selected}
              deleteOne={(id) => classApi.remove(id)}
              onDone={load}
              entityLabel="班级"
              canWrite={canWrite}
              hint={`确定删除选中的 ${selected.size} 个班级吗？若其下存在学生将无法删除，将自动跳过。此操作不可撤销。`}
            />
            <OrgSpreadsheetActions
              kind="classes"
              importTitle="导入班级"
              importHint="请先导入班主任信息。模板列：院系编码、专业编码、入学年份、班级名称、教工号*。教工号必须已在班主任信息中存在，否则该行导入失败。导入后会同步该班主任的管理班级。"
              onDone={load}
              hasFilter={Boolean(keyword || filterDept)}
              selectedIds={selected}
              buildFilterParams={() => ({
                keyword: keyword || undefined,
                dept_id: filterDept ? Number(filterDept) : undefined,
              })}
            />
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} />
              新增班级
            </Button>
          </ToolbarActions>
        )}
      </Toolbar>

      <DataTable
        columns={columns}
        data={list}
        rowKey={(c) => c.id}
        loading={loading}
        error={error}
        onRetry={load}
        emptyLabel={keyword || filterDept ? "无匹配班级" : "暂无班级。请先维护班主任信息，再新增或导入班级"}
        pinStartCount={canWrite ? 3 : 2}
        pinEndCount={1}
      />

      {!loading && !error && total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      <Modal
        open={formOpen}
        title={editing ? "编辑班级" : "新增班级"}
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
            <Label htmlFor="class-dept">所属院系 *</Label>
            <Select
              id="class-dept"
              className="w-full"
              value={deptId}
              onChange={(e) => {
                setDeptId(e.target.value);
                setMajorId("");
                setAdvisorStaffNo("");
              }}
            >
              <option value="">请选择院系</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="class-major">所属专业</Label>
            <Select id="class-major" className="w-full" value={majorId} onChange={(e) => setMajorId(e.target.value)}>
              <option value="">（可选）请选择专业</option>
              {formMajors.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="class-grade">所属年级</Label>
            <Select id="class-grade" className="w-full" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              <option value="">（可选）请选择年级</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="class-name">班级名称 *</Label>
            <Input id="class-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：软工2401班" />
          </div>
          <div>
            <Label htmlFor="class-advisor">班主任 *</Label>
            {!deptId ? (
              <p className="mt-1 text-sm text-ink-mute">请先选择院系</p>
            ) : advisorsLoading ? (
              <p className="mt-1 text-sm text-ink-mute">正在加载班主任…</p>
            ) : advisorsError ? (
              <p className="mt-1 text-sm text-error">{advisorsError}</p>
            ) : advisors.length === 0 ? (
              <p className="mt-1 text-sm text-ink-mute">该院系暂无班主任，请先在「班主任信息」中维护</p>
            ) : (
              <Combobox
                id="class-advisor"
                className="w-full"
                value={advisorStaffNo}
                onChange={setAdvisorStaffNo}
                placeholder="输入姓名或教工号搜索"
                emptyText="无匹配班主任"
                options={advisors.map((a) => ({
                  value: a.staff_no,
                  label: `${a.name}（${a.staff_no}）`,
                  description: a.phone || undefined,
                  keywords: `${a.name} ${a.staff_no} ${a.phone ?? ""}`,
                }))}
              />
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除班级"
        description={`确定删除班级「${deleteTarget?.name}」吗？若其下存在学生将无法删除。`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
