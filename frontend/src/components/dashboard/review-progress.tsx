"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { dashboardApi, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";
import type { DashboardDeptProgress } from "@/types/dashboard";

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
};

function reviewHref(year: number, deptId: number, classId: number, status: string): string {
  const params = new URLSearchParams();
  params.set("tab", "all");
  params.set("year", String(year));
  if (deptId > 0) params.set("dept_id", String(deptId));
  if (classId > 0) params.set("class_id", String(classId));
  if (status) params.set("status", status);
  return `/reviews?${params.toString()}`;
}

function CountLink({
  value,
  href,
}: {
  value: number;
  href?: string;
}) {
  if (value <= 0 || !href) {
    return <span className="text-ink-mute">0</span>;
  }
  return (
    <Link href={href} className="font-medium text-brand hover:underline">
      {value.toLocaleString()}
    </Link>
  );
}

export function ReviewProgressCard({
  year,
  depts,
}: {
  year: number;
  depts: DashboardDeptProgress[];
}) {
  const [open, setOpen] = React.useState<Set<number>>(() => new Set());
  const [exporting, setExporting] = React.useState(false);
  const pendingTotal = depts.reduce((sum, d) => sum + d.total, 0);

  const handleExport = async () => {
    setExporting(true);
    try {
      await dashboardApi.exportReviewProgress(year);
      toast.success("待审人数已导出");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const toggle = (deptId: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  return (
    <div className="mb-6 p-5" style={cardStyle}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">各系认定待审</h3>
          <p className="mt-1 text-xs text-ink-mute">
            {year} 学年已提交、尚未认定通过的申请。点数字可打开对应名单，便于通知各系完成审核。待院级含历史待审。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-mute">
            {depts.length} 个系 · {pendingTotal.toLocaleString()} 份待审
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => void handleExport()}
            title={`导出 ${year} 学年各系、各班待审人数`}
          >
            <Download size={14} />
            {exporting ? "导出中…" : "导出"}
          </Button>
        </div>
      </div>

      {depts.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-mute">当前学年各系均无待审申请</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-mute">
                <th className="px-2 py-2 font-medium">院系 / 班级</th>
                <th className="w-24 px-2 py-2 text-right font-medium">待班级</th>
                <th className="w-24 px-2 py-2 text-right font-medium">待教学系</th>
                <th className="w-24 px-2 py-2 text-right font-medium">待院级</th>
                <th className="w-20 px-2 py-2 text-right font-medium">合计</th>
              </tr>
            </thead>
            <tbody>
              {depts.map((dept) => {
                const expanded = open.has(dept.dept_id);
                return (
                  <React.Fragment key={dept.dept_id}>
                    <tr style={{ borderTop: "1px solid var(--color-border-light)" }}>
                      <td className="px-2 py-2.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-medium text-ink"
                          onClick={() => toggle(dept.dept_id)}
                          aria-expanded={expanded}
                        >
                          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {dept.dept_name}
                          <span className="font-normal text-ink-mute">({dept.classes.length} 个班)</span>
                        </button>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <CountLink
                          value={dept.pending_class}
                          href={dept.dept_id > 0 ? reviewHref(year, dept.dept_id, 0, "pending_class") : undefined}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <CountLink
                          value={dept.pending_dept}
                          href={dept.dept_id > 0 ? reviewHref(year, dept.dept_id, 0, "pending_dept") : undefined}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <CountLink
                          value={dept.pending_college}
                          href={dept.dept_id > 0 ? reviewHref(year, dept.dept_id, 0, "pending_college") : undefined}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-right font-medium text-ink">
                        {dept.total.toLocaleString()}
                      </td>
                    </tr>
                    {expanded &&
                      dept.classes.map((cls) => (
                        <tr
                          key={`${dept.dept_id}-${cls.class_id}`}
                          style={{ backgroundColor: "var(--color-bg-page)" }}
                        >
                          <td className="px-2 py-2 pl-8 text-ink-soft">{cls.class_name}</td>
                          <td className="px-2 py-2 text-right">
                            <CountLink
                              value={cls.pending_class}
                              href={
                                dept.dept_id > 0 && cls.class_id > 0
                                  ? reviewHref(year, dept.dept_id, cls.class_id, "pending_class")
                                  : undefined
                              }
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <CountLink
                              value={cls.pending_dept}
                              href={
                                dept.dept_id > 0 && cls.class_id > 0
                                  ? reviewHref(year, dept.dept_id, cls.class_id, "pending_dept")
                                  : undefined
                              }
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <CountLink
                              value={cls.pending_college}
                              href={
                                dept.dept_id > 0 && cls.class_id > 0
                                  ? reviewHref(year, dept.dept_id, cls.class_id, "pending_college")
                                  : undefined
                              }
                            />
                          </td>
                          <td className="px-2 py-2 text-right text-ink">{cls.total.toLocaleString()}</td>
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
