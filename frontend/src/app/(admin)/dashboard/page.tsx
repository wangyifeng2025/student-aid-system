"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Clock,
  CheckCircle,
  Banknote,
  AlertTriangle,
  CalendarRange,
  Building2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { dashboardApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { roleLabel } from "@/lib/labels";
import { getNavForRole, isStudent } from "@/lib/access";
import { STATUS_META } from "@/lib/recognition-options";
import { grantStatusMeta } from "@/lib/grant-options";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { Select } from "@/components/ui/select";
import type { NavItem, NavLeaf } from "@/lib/nav";
import type { Role } from "@/types/auth";
import type { ApplicationStatus } from "@/types/recognition";
import type { GrantStatus } from "@/types/grant";
import type { DashboardItem, DashboardKPI, DashboardOverview } from "@/types/dashboard";

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
};

const KPI_ICONS: Record<string, { icon: LucideIcon; iconColor: string; iconBg: string }> = {
  recognition_total: {
    icon: FileText,
    iconColor: "var(--color-primary)",
    iconBg: "var(--color-primary-subtle)",
  },
  recognition_action: {
    icon: AlertTriangle,
    iconColor: "var(--state-warning)",
    iconBg: "var(--state-warning-bg)",
  },
  recognition_todo: {
    icon: Clock,
    iconColor: "var(--state-warning)",
    iconBg: "var(--state-warning-bg)",
  },
  recognition_approved: {
    icon: CheckCircle,
    iconColor: "var(--state-success)",
    iconBg: "var(--state-success-bg)",
  },
  grant_total: {
    icon: Banknote,
    iconColor: "var(--state-info)",
    iconBg: "var(--state-info-bg)",
  },
  grant_todo: {
    icon: Banknote,
    iconColor: "var(--state-info)",
    iconBg: "var(--state-info-bg)",
  },
};

function flattenNavLeaves(items: NavItem[]): NavLeaf[] {
  const out: NavLeaf[] = [];
  for (const item of items) {
    if (item.type === "leaf") {
      if (!item.disabled && item.href !== "/dashboard" && item.href !== "#") out.push(item);
    } else {
      for (const child of item.children) {
        if (!child.disabled && child.href !== "#") out.push(child);
      }
    }
  }
  return out;
}

function itemHref(role: Role | undefined, item: DashboardItem): string {
  if (item.kind === "grant") {
    return isStudent(role) ? `/grants/${item.id}` : `/grant-reviews/${item.id}`;
  }
  return isStudent(role) ? `/recognitions/${item.id}` : `/reviews/${item.id}`;
}

function itemStatusLabel(item: DashboardItem): string {
  if (item.kind === "grant") {
    return grantStatusMeta(item.status as GrantStatus).label;
  }
  return (STATUS_META[item.status as ApplicationStatus] ?? { label: item.status }).label;
}

function itemDot(item: DashboardItem): string {
  const status = item.status;
  if (status === "approved") return "var(--state-success)";
  if (status === "rejected" || status === "draft") return "var(--state-warning)";
  return "var(--color-primary)";
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const yearNow = new Date().getFullYear();
  const [year, setYear] = React.useState(yearNow);
  const [data, setData] = React.useState<DashboardOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await dashboardApi.overview(year));
    } catch (e) {
      setData(null);
      setError(e instanceof ApiError ? e.message : "加载工作台失败");
    } finally {
      setLoading(false);
    }
  }, [year]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const quick = React.useMemo(() => {
    const leaves = flattenNavLeaves(getNavForRole(user?.role));
    if (isStudent(user?.role) && !leaves.some((l) => l.href === "/recognitions/new")) {
      return [
        { key: "new-recognition", label: "填报认定", href: "/recognitions/new", icon: FileText },
        ...leaves,
      ];
    }
    return leaves;
  }, [user?.role]);

  const student = isStudent(user?.role);
  const todoTitle = student ? "待处理申请" : "待办事项";
  const recentTitle = student ? "我的申请" : "范围内最近申请";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-lg font-semibold text-ink">
            <span>欢迎回来，{user?.real_name || user?.username}</span>
            {(data?.dept_name || data?.class_name) && (
              <span className="inline-flex flex-wrap items-center gap-1.5 font-normal">
                {data.dept_name ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs"
                    style={{
                      backgroundColor: "var(--color-primary-subtle)",
                      color: "var(--color-primary)",
                    }}
                  >
                    <Building2 size={12} />
                    {data.dept_name}
                  </span>
                ) : null}
                {data.class_name ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs"
                    style={{
                      backgroundColor: "var(--color-bg-page)",
                      color: "var(--color-text-secondary)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <Users size={12} />
                    {data.class_name}
                  </span>
                ) : null}
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-ink-mute">
            {roleLabel(user?.role)}
            {data?.scope_label ? ` · 数据范围：${data.scope_label}` : ""}
            。各板块仅展示你权限范围内的数据。
          </p>
        </div>
        <div
          className="flex items-center gap-3 px-3 py-2"
          style={cardStyle}
        >
          <div
            className="flex shrink-0 items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-primary-subtle)",
            }}
          >
            <CalendarRange size={16} style={{ color: "var(--color-primary)" }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-ink-mute">统计学年</p>
            <Select
              aria-label="统计学年"
              className="h-8 w-36 border-0 bg-transparent px-0 pr-7 font-medium shadow-none focus:ring-0"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[yearNow, yearNow - 1, yearNow - 2].map((y) => (
                <option key={y} value={y}>
                  {y} 学年
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState label="正在加载工作台…" />
      ) : error ? (
        <ErrorState label={error} onRetry={() => void load()} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(data?.kpis ?? []).map((k) => (
              <KpiCard key={k.key} kpi={k} />
            ))}
          </div>

          <div className="mb-6 grid grid-cols-1 items-stretch gap-6 xl:grid-cols-5">
            <div className="flex min-h-80 flex-col p-5 xl:col-span-3" style={cardStyle}>
              <div className="mb-4 flex shrink-0 items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">{todoTitle}</h3>
                <span className="text-xs text-ink-mute">{data?.scope_label}</span>
              </div>
              <ItemList
                items={data?.todos ?? []}
                role={user?.role}
                empty={student ? "暂无待处理的草稿或退回申请" : "暂无待审核事项"}
              />
            </div>
            <div className="flex min-h-80 flex-col p-5 xl:col-span-2" style={cardStyle}>
              <div className="mb-4 flex shrink-0 items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">{recentTitle}</h3>
                <span className="text-xs text-ink-mute">{year} 学年</span>
              </div>
              <ItemList
                items={data?.recents ?? []}
                role={user?.role}
                empty="当前学年暂无申请记录"
              />
            </div>
          </div>

          {quick.length > 0 && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {quick.map((q) => {
                const Icon = q.icon;
                return (
                  <Link
                    key={q.key}
                    href={q.href}
                    className="flex items-center gap-3 p-4 transition-colors hover:border-brand"
                    style={cardStyle}
                  >
                    <div
                      className="flex shrink-0 items-center justify-center"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--radius-md)",
                        backgroundColor: "var(--color-primary-subtle)",
                      }}
                    >
                      <Icon size={16} style={{ color: "var(--color-primary)" }} />
                    </div>
                    <span className="text-sm font-medium text-ink">{q.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ kpi }: { kpi: DashboardKPI }) {
  const style = KPI_ICONS[kpi.key] ?? KPI_ICONS.recognition_total;
  const Icon = style.icon;
  const warn = (kpi.key === "recognition_todo" || kpi.key === "recognition_action" || kpi.key === "grant_todo") && kpi.value > 0;
  return (
    <div className="flex items-center gap-4 p-5" style={cardStyle}>
      <div
        className="flex shrink-0 items-center justify-center"
        style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", backgroundColor: style.iconBg }}
      >
        <Icon size={20} style={{ color: style.iconColor }} />
      </div>
      <div>
        <p className="mb-1 text-xs text-ink-mute">{kpi.label}</p>
        <p className="text-xl font-bold tracking-tight text-ink">{kpi.value.toLocaleString()}</p>
        <p className="mt-0.5 text-xs" style={{ color: warn ? "var(--state-warning)" : "var(--color-text-muted)" }}>
          {kpi.hint}
        </p>
      </div>
    </div>
  );
}

function ItemList({
  items,
  role,
  empty,
}: {
  items: DashboardItem[];
  role?: Role;
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <p className="flex flex-1 items-center justify-center text-center text-sm text-ink-mute">
        {empty}
      </p>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      {items.map((item, i) => (
        <Link
          key={`${item.kind}-${item.id}`}
          href={itemHref(role, item)}
          className="flex items-center gap-3 py-3"
          style={{ borderBottom: i < items.length - 1 ? "1px solid var(--color-border-light)" : "none" }}
        >
          <span
            className="shrink-0"
            style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", backgroundColor: itemDot(item) }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              {item.student_name || "未命名"}
              {item.class_name ? <span className="text-ink-mute"> · {item.class_name}</span> : null}
            </p>
            <p className="text-xs text-ink-soft">
              {item.title} — {itemStatusLabel(item)}
            </p>
          </div>
          <span className="shrink-0 text-xs text-ink-mute">{item.student_no}</span>
        </Link>
      ))}
    </div>
  );
}
