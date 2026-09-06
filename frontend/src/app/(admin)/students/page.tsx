"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, Upload } from "lucide-react";
import {
  studentApi,
  departmentApi,
  majorApi,
  classApi,
  dictApi,
  exportApi,
  ApiError,
} from "@/lib/api";
import type { Student, StudentInput } from "@/types/student";
import type { Class, Department, Major } from "@/types/org";
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
import {
  DataTable,
  CellText,
  type Column,
} from "@/components/base-data/data-table";
import { RowActions } from "@/components/base-data/row-actions";
import { Pagination } from "@/components/base-data/pagination";
import {
  BatchDeleteButton,
  checkboxColumn,
} from "@/components/base-data/batch-delete-button";
import {
  ExportButtons,
  type ExportScope,
} from "@/components/base-data/export-menu";
import { useRowSelection } from "@/hooks/use-row-selection";
import { ImportDialog } from "@/components/student/import-dialog";
import { FileTransferOverlay } from "@/components/ui/file-transfer-overlay";
import {
  difficultyLabel,
  difficultyTone,
  rosterGrantMeta,
  rosterRecognitionMeta,
} from "@/lib/recognition-options";

const DEFAULT_PAGE_SIZE = 20;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
  CURRENT_YEAR + 1,
  CURRENT_YEAR,
  CURRENT_YEAR - 1,
  CURRENT_YEAR - 2,
];

type KeyFilter = "" | "true" | "false";

function ProgressLink({
  href,
  status,
  kind,
}: {
  href: string | null;
  status?: string;
  kind: "recognition" | "grant";
}) {
  const meta =
    kind === "recognition"
      ? rosterRecognitionMeta(status)
      : rosterGrantMeta(status);
  const badge = <Badge tone={meta.tone}>{meta.label}</Badge>;
  if (!href) return badge;
  return (
    <Link href={href} className="inline-flex hover:opacity-80" title="查看申请">
      {badge}
    </Link>
  );
}

export default function StudentsPage() {
  const user = useAuthStore((s) => s.user);
  const canWrite = user?.role === "admin";
  const role = user?.role;
  const isStudentRole = role === "student";

  // 列表与分页
  const [list, setList] = React.useState<Student[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // 筛选
  const [keywordInput, setKeywordInput] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [filterDept, setFilterDept] = React.useState("");
  const [filterClass, setFilterClass] = React.useState("");
  const [filterKey, setFilterKey] = React.useState<KeyFilter>("");
  const [filterYear, setFilterYear] = React.useState(String(CURRENT_YEAR));

  // 基础数据（用于筛选与名称解析、表单联动）
  const [depts, setDepts] = React.useState<Department[]>([]);
  const [majors, setMajors] = React.useState<Major[]>([]);
  const [classes, setClasses] = React.useState<Class[]>([]);
  const [nations, setNations] = React.useState<DictItem[]>([]);
  const [politics, setPolitics] = React.useState<DictItem[]>([]);

  // 表单
  const [editing, setEditing] = React.useState<Student | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState<StudentInput>(emptyForm());

  const [deleteTarget, setDeleteTarget] = React.useState<Student | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const { selected, toggleRow, toggleAll, allSelected, clearSelection } =
    useRowSelection(list, (s) => s.id);

  function emptyForm(): StudentInput {
    return {
      student_no: "",
      name: "",
      gender: "",
      id_card: "",
      birth: "",
      nation: "",
      political_status: "",
      phone: "",
      enroll_time: "",
      dept_id: undefined,
      major_id: undefined,
      class_id: undefined,
    };
  }

  const deptName = React.useCallback(
    (id: number) =>
      id ? (depts.find((d) => d.id === id)?.name ?? `#${id}`) : "—",
    [depts],
  );
  const majorName = React.useCallback(
    (id: number) =>
      id ? (majors.find((m) => m.id === id)?.name ?? `#${id}`) : "—",
    [majors],
  );
  const className = React.useCallback(
    (id: number) =>
      id ? (classes.find((c) => c.id === id)?.name ?? `#${id}`) : "—",
    [classes],
  );

  // 首屏加载基础数据
  React.useEffect(() => {
    (async () => {
      try {
        const [d, m, c, n, p] = await Promise.all([
          departmentApi.list(),
          majorApi.list(),
          classApi.list(),
          dictApi.listByType("nation").catch(() => [] as DictItem[]),
          dictApi.listByType("political_status").catch(() => [] as DictItem[]),
        ]);
        setDepts(d);
        setMajors(m);
        setClasses(c);
        setNations(n);
        setPolitics(p);
      } catch {
        // 基础数据失败不阻塞学生列表，仅名称回退为 #id
      }
    })();
  }, []);

  const fetchList = React.useCallback(
    () =>
      studentApi.list({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        dept_id: filterDept ? Number(filterDept) : undefined,
        class_id: filterClass ? Number(filterClass) : undefined,
        is_key_group: filterKey === "" ? undefined : filterKey === "true",
        year: filterYear ? Number(filterYear) : CURRENT_YEAR,
      }),
    [page, pageSize, keyword, filterDept, filterClass, filterKey, filterYear],
  );

  const applyListResult = React.useCallback(
    (res: Awaited<ReturnType<typeof studentApi.list>>) => {
      setList(res.items);
      setTotal(res.total);
      setError(null);
      setLoading(false);
      clearSelection();
    },
    [clearSelection],
  );

  const applyListError = React.useCallback((e: unknown) => {
    setError(e instanceof ApiError ? e.message : "加载失败");
    setLoading(false);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    fetchList().then(
      (res) => {
        if (!cancelled) applyListResult(res);
      },
      (e: unknown) => {
        if (!cancelled) applyListError(e);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fetchList, applyListResult, applyListError]);

  const reload = () => {
    setLoading(true);
    return fetchList().then(applyListResult, applyListError);
  };

  // 筛选变更：重置到第 1 页
  const resetToFirst = () => {
    setLoading(true);
    setPage(1);
  };

  const submitSearch = () => {
    const next = keywordInput.trim();
    if (next === keyword && page === 1) {
      void reload();
      return;
    }
    setLoading(true);
    setKeyword(next);
    setPage(1);
  };

  const handlePageChange = (next: number) => {
    setLoading(true);
    setPage(next);
  };

  const handlePageSizeChange = (size: number) => {
    setLoading(true);
    setPageSize(size);
    setPage(1);
  };

  // 表单内专业/班级随院系联动
  const formMajors = form.dept_id
    ? majors.filter((m) => m.dept_id === form.dept_id)
    : majors;
  const formClasses = form.dept_id
    ? classes.filter((c) => c.dept_id === form.dept_id)
    : classes;
  const userDeptId = user?.dept_id;
  const userClassIds = user?.class_ids;
  const scopedDepts = React.useMemo(() => {
    if ((role === "classadvisor" || role === "department") && userDeptId) {
      return depts.filter((d) => d.id === userDeptId);
    }
    return depts;
  }, [depts, role, userDeptId]);

  const scopedClasses = React.useMemo(() => {
    let list = classes;
    if (role === "classadvisor" && userClassIds?.length) {
      list = list.filter((c) => userClassIds.includes(c.id));
    } else if (role === "department" && userDeptId) {
      list = list.filter((c) => c.dept_id === userDeptId);
    }
    if (filterDept) {
      list = list.filter((c) => c.dept_id === Number(filterDept));
    }
    return list;
  }, [classes, role, userClassIds, userDeptId, filterDept]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditing(s);
    setForm({
      student_no: s.student_no,
      name: s.name,
      gender: s.gender,
      birth: s.birth,
      nation: s.nation,
      political_status: s.political_status,
      id_card: s.id_card,
      phone: s.phone,
      enroll_time: s.enroll_time,
      dept_id: s.dept_id || undefined,
      major_id: s.major_id || undefined,
      class_id: s.class_id || undefined,
    });
    setFormOpen(true);
  };

  const setField = <K extends keyof StudentInput>(
    key: K,
    value: StudentInput[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.student_no?.trim()) {
      toast.error("请填写学号");
      return;
    }
    if (!form.name?.trim()) {
      toast.error("请填写姓名");
      return;
    }
    if (!form.id_card?.trim()) {
      toast.error("请填写身份证号");
      return;
    }
    if (!form.gender) {
      toast.error("请选择性别");
      return;
    }
    if (!form.dept_id) {
      toast.error("请选择所属院系");
      return;
    }
    if (!form.major_id) {
      toast.error("请选择所属专业");
      return;
    }
    if (!form.class_id) {
      toast.error("请选择所属班级");
      return;
    }
    setSubmitting(true);
    try {
      const body: StudentInput = {
        ...form,
        student_no: form.student_no.trim(),
        name: form.name.trim(),
        id_card: form.id_card.trim().toUpperCase(),
      };
      if (editing) {
        await studentApi.update(editing.id, body);
        toast.success("已更新学生，关联登录账号已同步");
      } else {
        const created = await studentApi.create(body);
        if (created.initial_password) {
          toast.success(
            `已新增学生并创建登录账号（用户名 ${created.student_no}，初始密码 ${created.initial_password}），请告知学生尽快登录修改密码`,
          );
        } else {
          toast.success("已新增学生");
        }
      }
      setFormOpen(false);
      await reload();
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
      await studentApi.remove(deleteTarget.id);
      toast.success("已删除学生");
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (scope: ExportScope) => {
    if (scope === "selected" && selected.size === 0) {
      toast.info("请先勾选要导出的学生");
      return;
    }
    setExporting(true);
    try {
      if (scope === "all") {
        await exportApi.students();
      } else if (scope === "filtered") {
        await exportApi.students({
          keyword: keyword || undefined,
          dept_id: filterDept ? Number(filterDept) : undefined,
          class_id: filterClass ? Number(filterClass) : undefined,
          is_key_group: filterKey === "" ? undefined : filterKey === "true",
          year: filterYear ? Number(filterYear) : CURRENT_YEAR,
        });
      } else {
        await exportApi.students(undefined, Array.from(selected));
      }
      toast.success("学生数据已导出");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const hasStudentFilter = Boolean(
    keyword ||
    filterDept ||
    filterClass ||
    filterKey ||
    filterYear !== String(CURRENT_YEAR),
  );

  const columns: Column<Student>[] = [
    ...(canWrite
      ? [
          checkboxColumn<Student>(
            selected,
            allSelected,
            toggleAll,
            toggleRow,
            (s) => s.id,
            (s) => s.name,
          ),
        ]
      : []),
    {
      header: "学号",
      width: "130px",
      cell: (s) => <span className="font-mono text-ink">{s.student_no}</span>,
    },
    { header: "姓名", cell: (s) => <span className="text-ink">{s.name}</span> },
    { header: "性别", width: "70px", cell: (s) => s.gender || "—" },
    {
      header: "院系",
      width: "160px",
      cell: (s) => <CellText>{s.dept_name || deptName(s.dept_id)}</CellText>,
    },
    {
      header: "专业",
      width: "160px",
      cell: (s) => <CellText>{majorName(s.major_id)}</CellText>,
    },
    {
      header: "班级",
      width: "230px",
      cell: (s) => <CellText>{s.class_name || className(s.class_id)}</CellText>,
    },
    {
      header: "重点人群",
      width: "100px",
      cell: (s) =>
        s.is_key_group ? (
          <Badge tone="warning">重点</Badge>
        ) : (
          <span className="text-ink-mute">否</span>
        ),
    },
    {
      header: "认定",
      width: "128px",
      cell: (s) => (
        <ProgressLink
          kind="recognition"
          status={s.recognition_status}
          href={
            s.recognition_id
              ? s.recognition_status === "draft"
                ? `/recognitions/${s.recognition_id}`
                : `/reviews/${s.recognition_id}`
              : null
          }
        />
      ),
    },
    ...(!isStudentRole
      ? [
          {
            header: "困难等级",
            width: "96px",
            cell: (s: Student) =>
              s.difficulty_level ? (
                <Badge tone={difficultyTone(s.difficulty_level)}>
                  {difficultyLabel(s.difficulty_level)}
                </Badge>
              ) : (
                <span className="text-ink-mute">未评定</span>
              ),
          } satisfies Column<Student>,
        ]
      : []),
    {
      header: "助学金",
      width: "112px",
      cell: (s) => (
        <ProgressLink
          kind="grant"
          status={s.grant_status}
          href={
            s.grant_id
              ? s.grant_status === "draft"
                ? `/grants/${s.grant_id}`
                : `/grant-reviews/${s.grant_id}`
              : null
          }
        />
      ),
    },
    ...(canWrite
      ? [
          {
            header: "操作",
            width: "120px",
            cell: (s: Student) => (
              <RowActions
                canWrite={canWrite}
                onEdit={() => openEdit(s)}
                onDelete={() => setDeleteTarget(s)}
              />
            ),
          } satisfies Column<Student>,
        ]
      : []),
  ];

  return (
    <div>
      <Toolbar>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-0" style={{ width: 240 }}>
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-mute"
            />
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSearch()}
              placeholder="搜索姓名/学号/身份证…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select
            value={filterDept}
            onChange={(e) => {
              setFilterDept(e.target.value);
              setFilterClass("");
              resetToFirst();
            }}
          >
            <option value="">全部院系</option>
            {scopedDepts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select
            value={filterClass}
            onChange={(e) => {
              setFilterClass(e.target.value);
              resetToFirst();
            }}
          >
            <option value="">全部班级</option>
            {scopedClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={filterYear}
            onChange={(e) => {
              setFilterYear(e.target.value);
              resetToFirst();
            }}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y} 学年
              </option>
            ))}
          </Select>
          <Select
            value={filterKey}
            onChange={(e) => {
              setFilterKey(e.target.value as KeyFilter);
              resetToFirst();
            }}
          >
            <option value="">全部人群</option>
            <option value="true">仅重点人群</option>
            <option value="false">非重点人群</option>
          </Select>
          <Button variant="outline" size="sm" onClick={submitSearch}>
            查询
          </Button>
        </div>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            <BatchDeleteButton
              selectedIds={selected}
              deleteOne={(id) => studentApi.remove(id)}
              onDone={reload}
              entityLabel="学生"
              canWrite={canWrite}
              hint={`确定删除选中的 ${selected.size} 名学生吗？无申报的将彻底删除登录账号；已有认定或助学金申报的无法删除，将自动跳过。`}
            />
            <ExportButtons
              onExport={handleExport}
              exporting={exporting}
              selectedCount={selected.size}
              hasFilter={hasStudentFilter}
              label="导出"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              <Upload size={16} />
              导入名单
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus size={16} />
              新增学生
            </Button>
          </div>
        )}
      </Toolbar>

      {!canWrite && (
        <p className="mb-3 text-xs text-ink-mute">
          仅显示您数据范围内的学生。认定 /
          助学金列为所选学年进度，未提交的学生也会列出。
        </p>
      )}

      <DataTable
        columns={columns}
        data={list}
        rowKey={(s) => s.id}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyLabel={
          keyword || filterDept || filterClass || filterKey
            ? "无匹配学生"
            : "暂无学生，可新增或导入名单"
        }
        pinStartCount={canWrite ? 2 : 1}
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
        size="lg"
        title={editing ? "编辑学生" : "新增学生"}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFormOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "保存中…" : "保存"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          {!editing && (
            <div
              className="col-span-2 rounded-md px-3 py-2 text-xs"
              style={{
                background: "var(--color-primary-subtle)",
                color: "var(--color-primary)",
              }}
            >
              保存后将自动在「用户管理」创建学生登录账号：用户名=学号，初始密码=Stu＋身份证后
              6 位。请告知学生登录后尽快修改密码。
            </div>
          )}
          <div>
            <Label htmlFor="stu-no">学号 *</Label>
            <Input
              id="stu-no"
              value={form.student_no}
              onChange={(e) => setField("student_no", e.target.value)}
              placeholder="如：2024010101"
            />
          </div>
          <div>
            <Label htmlFor="stu-name">姓名 *</Label>
            <Input
              id="stu-name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="学生姓名"
            />
          </div>
          <div>
            <Label htmlFor="stu-gender">性别 *</Label>
            <Select
              id="stu-gender"
              className="w-full"
              value={form.gender}
              onChange={(e) => setField("gender", e.target.value)}
            >
              <option value="">请选择</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="stu-idcard">身份证号 *</Label>
            <Input
              id="stu-idcard"
              value={form.id_card}
              onChange={(e) => setField("id_card", e.target.value)}
              placeholder="18 位居民身份证"
            />
          </div>
          <div>
            <Label htmlFor="stu-phone">手机号</Label>
            <Input
              id="stu-phone"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="11 位手机号"
            />
          </div>
          <div>
            <Label htmlFor="stu-nation">民族</Label>
            <Select
              id="stu-nation"
              className="w-full"
              value={form.nation}
              onChange={(e) => setField("nation", e.target.value)}
            >
              <option value="">未填写</option>
              {nations.map((n) => (
                <option key={n.code} value={n.code}>
                  {n.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="stu-political">政治面貌</Label>
            <Select
              id="stu-political"
              className="w-full"
              value={form.political_status}
              onChange={(e) => setField("political_status", e.target.value)}
            >
              <option value="">未填写</option>
              {politics.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="stu-birth">出生年月</Label>
            <Input
              id="stu-birth"
              type="date"
              value={form.birth}
              onChange={(e) => setField("birth", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="stu-enroll">入学时间</Label>
            <Input
              id="stu-enroll"
              type="date"
              value={form.enroll_time}
              onChange={(e) => setField("enroll_time", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="stu-dept">所属院系 *</Label>
            <Select
              id="stu-dept"
              className="w-full"
              value={form.dept_id ?? ""}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : undefined;
                setForm((prev) => ({
                  ...prev,
                  dept_id: v,
                  major_id: undefined,
                  class_id: undefined,
                }));
              }}
            >
              <option value="">请选择</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="stu-major">所属专业 *</Label>
            <Select
              id="stu-major"
              className="w-full"
              value={form.major_id ?? ""}
              onChange={(e) =>
                setField(
                  "major_id",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
            >
              <option value="">请选择</option>
              {formMajors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="stu-class">所属班级 *</Label>
            <Select
              id="stu-class"
              className="w-full"
              value={form.class_id ?? ""}
              onChange={(e) =>
                setField(
                  "class_id",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
            >
              <option value="">请选择</option>
              {formClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除学生"
        description={`确定删除学生「${deleteTarget?.name}（${deleteTarget?.student_no}）」吗？无申报时将彻底删除学籍和登录账号；已有认定或助学金申报则无法删除。`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ImportDialog
        open={importOpen}
        kind="students"
        title="导入录取/新生名单"
        hint="按模板列填写：学号*、姓名*、性别*（男/女）、身份证号*、院系*、专业*、班级* 为必填；民族、政治面貌填写中文名称（如汉族、共青团员），可留空；其余可选。学号与身份证号均须唯一。已存在的学号将按学号更新（增量导入）。导入时会自动为每位学生创建登录账号（用户名=学号，初始密码=Stu＋身份证后 6 位）。"
        onClose={() => setImportOpen(false)}
        onImported={reload}
      />
      <FileTransferOverlay
        open={exporting}
        title="正在导出学生数据"
        hint="名单较多时请耐心等待，系统仍在生成 Excel，请勿关闭页面。"
        tauSeconds={26}
      />
    </div>
  );
}
