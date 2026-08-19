"use client";

import * as React from "react";
import { Plus, Search, KeyRound } from "lucide-react";
import { userApi, departmentApi, classApi, ApiError } from "@/lib/api";
import type { User, UserCreateInput, UserUpdateInput } from "@/types/user";
import type { Role } from "@/types/auth";
import type { Department, Class } from "@/types/org";
import { ROLE_LABELS, roleLabel } from "@/lib/labels";
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
import { Pagination } from "@/components/base-data/pagination";
import { BatchDeleteButton, checkboxColumn } from "@/components/base-data/batch-delete-button";
import { useRowSelection } from "@/hooks/use-row-selection";
import { useAuthStore } from "@/store/auth";

const DEFAULT_PAGE_SIZE = 20;

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [Role, string][];

// 需要关联院系的角色（学生/班主任/教学系）。
const NEEDS_DEPT: Role[] = ["student", "classadvisor", "department"];
// 需要关联班级的角色（学生/班主任）。
const NEEDS_CLASS: Role[] = ["student", "classadvisor"];

interface FormState {
  username: string;
  password: string;
  real_name: string;
  role: Role;
  phone: string;
  dept_id: string;
  class_id: string;
  status: number;
}

const emptyForm: FormState = {
  username: "",
  password: "",
  real_name: "",
  role: "student",
  phone: "",
  dept_id: "",
  class_id: "",
  status: 1,
};

export default function UsersPage() {
  const canWrite = useAuthStore((s) => s.user?.role === "admin");

  const [list, setList] = React.useState<User[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const { selected, toggleRow, toggleAll, allSelected, clearSelection } = useRowSelection(list, (u) => u.id);

  const [keywordInput, setKeywordInput] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [filterRole, setFilterRole] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");

  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [classes, setClasses] = React.useState<Class[]>([]);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<User | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<User | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const [resetTarget, setResetTarget] = React.useState<User | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [resetting, setResetting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userApi.list({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        role: filterRole || undefined,
        status: filterStatus === "" ? undefined : Number(filterStatus),
      });
      setList(res.items);
      setTotal(res.total);
      clearSelection();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, filterRole, filterStatus, clearSelection]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // 院系/班级下拉数据（用于审核角色的数据范围设置与列表展示）。
  React.useEffect(() => {
    departmentApi
      .list()
      .then(setDepartments)
      .catch(() => setDepartments([]));
    classApi
      .list()
      .then(setClasses)
      .catch(() => setClasses([]));
  }, []);

  const deptName = React.useCallback(
    (id?: number | null) => departments.find((d) => d.id === id)?.name ?? "",
    [departments],
  );
  const className = React.useCallback(
    (id?: number | null) => classes.find((c) => c.id === id)?.name ?? "",
    [classes],
  );

  const submitSearch = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({
      username: u.username,
      password: "",
      real_name: u.real_name,
      role: u.role,
      phone: u.phone ?? "",
      dept_id: u.dept_id ? String(u.dept_id) : "",
      class_id: u.class_id ? String(u.class_id) : "",
      status: u.status,
    });
    setFormOpen(true);
  };

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const handleSubmit = async () => {
    if (!editing && !form.username.trim()) {
      toast.error("请填写用户名（学号/工号）");
      return;
    }
    if (!editing && !form.password.trim()) {
      toast.error("请设置初始密码");
      return;
    }
    if (!form.real_name.trim()) {
      toast.error("请填写姓名");
      return;
    }

    const needsDept = NEEDS_DEPT.includes(form.role);
    const needsClass = NEEDS_CLASS.includes(form.role);
    const deptId = needsDept && form.dept_id ? Number(form.dept_id) : null;
    const classId = needsClass && form.class_id ? Number(form.class_id) : null;

    setSubmitting(true);
    try {
      if (editing) {
        const body: UserUpdateInput = {
          real_name: form.real_name.trim(),
          role: form.role,
          phone: form.phone.trim() || undefined,
          dept_id: deptId,
          class_id: classId,
          status: form.status,
        };
        await userApi.update(editing.id, body);
        toast.success("已更新用户");
      } else {
        const body: UserCreateInput = {
          username: form.username.trim(),
          password: form.password,
          real_name: form.real_name.trim(),
          role: form.role,
          phone: form.phone.trim() || undefined,
          dept_id: deptId,
          class_id: classId,
          status: form.status,
        };
        await userApi.create(body);
        toast.success("已新增用户");
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
      await userApi.remove(deleteTarget.id);
      toast.success("已删除用户");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    if (!newPassword.trim()) {
      toast.error("请输入新密码");
      return;
    }
    setResetting(true);
    try {
      await userApi.resetPassword(resetTarget.id, { new_password: newPassword });
      toast.success(`已重置 ${resetTarget.real_name || resetTarget.username} 的密码`);
      setResetTarget(null);
      setNewPassword("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "重置失败");
    } finally {
      setResetting(false);
    }
  };

  const scopeText = (u: User) => {
    if (NEEDS_CLASS.includes(u.role)) {
      const parts = [deptName(u.dept_id), className(u.class_id)].filter(Boolean);
      return parts.length ? parts.join(" / ") : "—";
    }
    if (NEEDS_DEPT.includes(u.role)) {
      return deptName(u.dept_id) || "—";
    }
    if (u.role === "aidcenter" || u.role === "admin") return "全校";
    return "—";
  };

  const columns: Column<User>[] = [
    ...(canWrite
      ? [checkboxColumn(selected, allSelected, toggleAll, toggleRow, (u) => u.id, (u) => u.real_name || u.username)]
      : []),
    {
      header: "用户名",
      cell: (u) => <span className="font-mono text-ink">{u.username}</span>,
    },
    {
      header: "姓名",
      cell: (u) => <span className="text-ink">{u.real_name || "—"}</span>,
    },
    {
      header: "角色",
      width: "130px",
      cell: (u) => <Badge tone="brand">{roleLabel(u.role)}</Badge>,
    },
    {
      header: "数据范围",
      cell: (u) => <span className="text-sm">{scopeText(u)}</span>,
    },
    {
      header: "手机号",
      width: "130px",
      cell: (u) => <span className="tabular-nums">{u.phone || "—"}</span>,
    },
    {
      header: "状态",
      width: "90px",
      cell: (u) =>
        u.status === 1 ? (
          <Badge tone="success">启用</Badge>
        ) : (
          <Badge tone="error">禁用</Badge>
        ),
    },
    {
      header: "操作",
      width: "180px",
      cell: (u) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => openEdit(u)}
            className="text-sm text-link transition-colors hover:underline"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={() => {
              setResetTarget(u);
              setNewPassword("");
            }}
            className="inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:underline"
          >
            <KeyRound size={13} />
            重置密码
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(u)}
            className="text-sm transition-colors hover:underline"
            style={{ color: "var(--state-error)" }}
          >
            删除
          </button>
        </div>
      ),
    },
  ];

  const showDept = NEEDS_DEPT.includes(form.role);
  const showClass = NEEDS_CLASS.includes(form.role);

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
              placeholder="搜索用户名 / 姓名 / 手机号…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select
            value={filterRole}
            onChange={(e) => {
              setFilterRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部角色</option>
            {ROLE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部状态</option>
            <option value="1">启用</option>
            <option value="0">禁用</option>
          </Select>
          <Button variant="outline" size="sm" onClick={submitSearch}>
            查询
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <BatchDeleteButton
            selectedIds={selected}
            deleteOne={(id) => userApi.remove(id)}
            onDone={load}
            entityLabel="用户"
            canWrite={canWrite}
          />
          <Button size="sm" onClick={openCreate}>
            <Plus size={16} />
            新增用户
          </Button>
        </div>
      </Toolbar>

      <div
        className="mb-3 rounded-md px-3 py-2 text-xs"
        style={{
          background: "var(--color-primary-subtle)",
          color: "var(--color-primary)",
        }}
      >
        提示：学生登录账号无需在此手动创建。新增或导入学生时系统会自动创建账号（用户名=学号，初始密码=Stu＋身份证后 6 位），并随学生信息同步更新；删除学生时账号一并删除，认定与助学金申报记录会保留备查。此处主要用于管理班主任、教学系、资助中心、管理员等审核角色账号。
      </div>

      <DataTable
        columns={columns}
        data={list}
        rowKey={(u) => u.id}
        loading={loading}
        error={error}
        onRetry={load}
        emptyLabel="暂无用户，点击右上角新增"
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
        title={editing ? "编辑用户" : "新增用户"}
        onClose={() => setFormOpen(false)}
        size="lg"
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="u-username">用户名（学号/工号）{!editing && " *"}</Label>
            <Input
              id="u-username"
              value={form.username}
              onChange={(e) => patch({ username: e.target.value })}
              placeholder="登录账号，创建后不可修改"
              disabled={!!editing}
            />
          </div>
          <div>
            <Label htmlFor="u-realname">姓名 *</Label>
            <Input
              id="u-realname"
              value={form.real_name}
              onChange={(e) => patch({ real_name: e.target.value })}
              placeholder="真实姓名"
            />
          </div>

          {!editing && (
            <div>
              <Label htmlFor="u-password">初始密码 *</Label>
              <Input
                id="u-password"
                value={form.password}
                onChange={(e) => patch({ password: e.target.value })}
                placeholder="≥6 位，含字母和数字"
              />
            </div>
          )}

          <div>
            <Label htmlFor="u-role">角色 *</Label>
            <Select
              id="u-role"
              value={form.role}
              onChange={(e) => patch({ role: e.target.value as Role })}
              className="w-full"
            >
              {ROLE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="u-phone">手机号</Label>
            <Input
              id="u-phone"
              value={form.phone}
              onChange={(e) => patch({ phone: e.target.value })}
              placeholder="用于找回密码（可选）"
            />
          </div>

          <div>
            <Label htmlFor="u-status">状态</Label>
            <Select
              id="u-status"
              value={String(form.status)}
              onChange={(e) => patch({ status: Number(e.target.value) })}
              className="w-full"
            >
              <option value="1">启用</option>
              <option value="0">禁用</option>
            </Select>
          </div>

          {showDept && (
            <div>
              <Label htmlFor="u-dept">所属院系（数据范围）</Label>
              <Select
                id="u-dept"
                value={form.dept_id}
                onChange={(e) => patch({ dept_id: e.target.value })}
                className="w-full"
              >
                <option value="">未设置</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {showClass && (
            <div>
              <Label htmlFor="u-class">所属班级（数据范围）</Label>
              <Select
                id="u-class"
                value={form.class_id}
                onChange={(e) => patch({ class_id: e.target.value })}
                className="w-full"
              >
                <option value="">未设置</option>
                {classes
                  .filter((c) => !form.dept_id || c.dept_id === Number(form.dept_id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </div>
          )}
        </div>

        {(showDept || showClass) && (
          <p className="mt-3 text-xs text-ink-mute">
            学生与班主任关联到院系/班级，教学系关联到院系，资助中心/管理员默认全校。
          </p>
        )}
      </Modal>

      <Modal
        open={resetTarget !== null}
        title="重置密码"
        onClose={() => setResetTarget(null)}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setResetTarget(null)} disabled={resetting}>
              取消
            </Button>
            <Button size="sm" onClick={handleReset} disabled={resetting}>
              {resetting ? "重置中…" : "确认重置"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">
            为用户「{resetTarget?.real_name || resetTarget?.username}」设置新密码，用户下次可用新密码登录。
          </p>
          <div>
            <Label htmlFor="u-newpass">新密码</Label>
            <Input
              id="u-newpass"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="≥6 位，含字母和数字"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除用户"
        description={`确定删除用户「${deleteTarget?.real_name || deleteTarget?.username}」吗？该操作不可撤销。`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
