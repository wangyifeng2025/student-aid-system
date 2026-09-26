"use client";

import * as React from "react";
import { classApi, departmentApi, ApiError } from "@/lib/api";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { useAuthStore } from "@/store/auth";
import type { Class, Department } from "@/types/org";
import type { Role } from "@/types/auth";

export type OrgScopeValue = {
  deptId: number;
  classId: number;
};

type Props = {
  value: OrgScopeValue;
  onChange: (next: OrgScopeValue) => void;
  /** 额外 className，挂在容器上 */
  className?: string;
};

function canFilterDept(role: Role | undefined): boolean {
  return role === "aidcenter" || role === "admin";
}

function canFilterClass(role: Role | undefined): boolean {
  return role === "department" || role === "aidcenter" || role === "admin";
}

/**
 * 教学系/资助中心审核列表的组织范围筛选：
 * - 教学系：按本系班级筛选
 * - 资助中心/管理员：按院系 + 班级筛选
 * - 班主任：不展示（数据范围已固定本班）
 */
export function OrgScopeFilters({ value, onChange, className }: Props) {
  const role = useAuthStore((s) => s.user?.role);
  const userDeptId = useAuthStore((s) => s.user?.dept_id);

  const showDept = canFilterDept(role);
  const showClass = canFilterClass(role);

  const [depts, setDepts] = React.useState<Department[]>([]);
  const [classes, setClasses] = React.useState<Class[]>([]);

  React.useEffect(() => {
    if (!showDept) return;
    let cancelled = false;
    (async () => {
      try {
        const items = await departmentApi.list();
        if (!cancelled) setDepts(items);
      } catch (e) {
        console.error(e instanceof ApiError ? e.message : e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showDept]);

  const classDeptId = showDept ? value.deptId || 0 : userDeptId || 0;

  React.useEffect(() => {
    if (!showClass) return;
    // 资助中心未选院系时不拉全校班级，避免列表过长；教学系用本人 dept_id。
    if (showDept && !classDeptId) {
      setClasses([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const items = await classApi.list({
          deptId: classDeptId || undefined,
        });
        if (!cancelled) setClasses(items);
      } catch (e) {
        console.error(e instanceof ApiError ? e.message : e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showClass, showDept, classDeptId]);

  if (!showDept && !showClass) return null;

  return (
    <div className={className ? `flex items-center gap-1.5 ${className}` : "flex items-center gap-1.5"}>
      {showDept && (
        <FilterCombobox
          size="wide"
          value={value.deptId ? String(value.deptId) : ""}
          placeholder="全部院系"
          options={depts.map((d) => ({ value: String(d.id), label: d.name }))}
          onValueChange={(next) => onChange({ deptId: Number(next) || 0, classId: 0 })}
        />
      )}
      {showClass && (
        <FilterCombobox
          size="wide"
          value={value.classId ? String(value.classId) : ""}
          placeholder="全部班级"
          disabled={showDept && !value.deptId && classes.length === 0}
          options={classes.map((c) => ({ value: String(c.id), label: c.name }))}
          onValueChange={(next) => onChange({ deptId: value.deptId, classId: Number(next) || 0 })}
        />
      )}
    </div>
  );
}

export function orgScopeParams(value: OrgScopeValue): { dept_id?: number; class_id?: number } {
  return {
    dept_id: value.deptId || undefined,
    class_id: value.classId || undefined,
  };
}
