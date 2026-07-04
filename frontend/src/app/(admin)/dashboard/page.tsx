"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Clock,
  CheckCircle,
  Banknote,
  Megaphone,
  BarChart3,
  Database,
  ListTree,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";

interface Kpi {
  label: string;
  value: string;
  hint: string;
  hintTone: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}

const KPIS: Kpi[] = [
  {
    label: "认定申请",
    value: "1,286",
    hint: "+32 本周",
    hintTone: "var(--state-success)",
    icon: FileText,
    iconColor: "var(--color-primary)",
    iconBg: "var(--color-primary-subtle)",
  },
  {
    label: "待审核",
    value: "48",
    hint: "-12 较昨日",
    hintTone: "var(--state-success)",
    icon: Clock,
    iconColor: "var(--state-warning)",
    iconBg: "var(--state-warning-bg)",
  },
  {
    label: "已通过",
    value: "1,198",
    hint: "93.2% 通过率",
    hintTone: "var(--color-text-muted)",
    icon: CheckCircle,
    iconColor: "var(--state-success)",
    iconBg: "var(--state-success-bg)",
  },
  {
    label: "资助发放",
    value: "¥285.6万",
    hint: "已发放 85%",
    hintTone: "var(--color-text-muted)",
    icon: Banknote,
    iconColor: "var(--state-info)",
    iconBg: "var(--state-info-bg)",
  },
];

interface Task {
  name: string;
  klass: string;
  desc: string;
  time: string;
  dot: string;
}

const TASKS: Task[] = [
  { name: "张三", klass: "计科2301", desc: "班级评审 — 困难等级待定", time: "10分钟前", dot: "var(--color-primary)" },
  { name: "李四", klass: "软工2302", desc: "教学系评审 — 退回待重填", time: "30分钟前", dot: "var(--state-warning)" },
  { name: "王五", klass: "计科2301", desc: "班级评审 — 家庭成员信息不全", time: "2小时前", dot: "var(--color-primary)" },
  { name: "赵六", klass: "数科2301", desc: "院级评审 — 等待最终确认", time: "昨天", dot: "var(--state-success)" },
  { name: "钱七", klass: "英语2303", desc: "公示中 — 异议处理待确认", time: "昨天", dot: "var(--state-warning)" },
];

const ACTIVITIES: { text: string; time: string }[] = [
  { text: "张三 提交了困难认定申请", time: "10分钟前" },
  { text: "李四 的班级评审已通过", time: "30分钟前" },
  { text: "王五 的申请被教学系退回", time: "1小时前" },
  { text: "系统导出了认定汇总表", time: "3小时前" },
  { text: "赵六 提交了助学金申请", time: "昨天" },
  { text: "公示期已结束，结果已确认", time: "昨天" },
];

interface Quick {
  label: string;
  icon: LucideIcon;
  href: string;
}

const QUICK: Quick[] = [
  { label: "院系管理", icon: Database, href: "/base-data/departments" },
  { label: "字典管理", icon: ListTree, href: "/base-data/dicts" },
  { label: "发布公示", icon: Megaphone, href: "/dashboard" },
  { label: "查看名额", icon: BarChart3, href: "/dashboard" },
];

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-ink">
          欢迎回来，{user?.real_name || user?.username}
        </h2>
        <p className="mt-0.5 text-sm text-ink-mute">
          这里是资助管理工作台，可快速查看待办与系统动态。
        </p>
      </div>

      {/* KPI 卡片 */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {KPIS.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="flex items-center gap-4 p-5" style={cardStyle}>
              <div
                className="flex shrink-0 items-center justify-center"
                style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", backgroundColor: k.iconBg }}
              >
                <Icon size={20} style={{ color: k.iconColor }} />
              </div>
              <div>
                <p className="mb-1 text-xs text-ink-mute">{k.label}</p>
                <p className="text-xl font-bold tracking-tight text-ink">{k.value}</p>
                <p className="mt-0.5 text-xs" style={{ color: k.hintTone }}>{k.hint}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 待办 + 动态 */}
      <div className="mb-6 flex items-start gap-6">
        <div style={{ flex: 3 }}>
          <div className="p-5" style={cardStyle}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">待办事项</h3>
              <span className="text-xs font-medium text-ink-mute">演示数据</span>
            </div>
            <div className="flex flex-col">
              {TASKS.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-3"
                  style={{ borderBottom: i < TASKS.length - 1 ? "1px solid var(--color-border-light)" : "none" }}
                >
                  <span className="shrink-0" style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", backgroundColor: t.dot }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {t.name} <span className="text-ink-mute">· {t.klass}</span>
                    </p>
                    <p className="text-xs text-ink-soft">{t.desc}</p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-mute">{t.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: 2 }}>
          <div className="p-5" style={cardStyle}>
            <h3 className="mb-4 text-sm font-semibold text-ink">最近动态</h3>
            <div className="flex flex-col">
              {ACTIVITIES.map((a, i) => (
                <div
                  key={i}
                  className="py-2.5"
                  style={{ borderBottom: i < ACTIVITIES.length - 1 ? "1px solid var(--color-border-light)" : "none" }}
                >
                  <p className="text-sm text-ink">{a.text}</p>
                  <p className="text-xs text-ink-mute">{a.time}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-4 gap-4">
        {QUICK.map((q) => {
          const Icon = q.icon;
          return (
            <Link
              key={q.label}
              href={q.href}
              className="flex items-center gap-3 p-4 transition-colors hover:border-brand"
              style={cardStyle}
            >
              <div
                className="flex shrink-0 items-center justify-center"
                style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", backgroundColor: "var(--color-primary-subtle)" }}
              >
                <Icon size={16} style={{ color: "var(--color-primary)" }} />
              </div>
              <span className="text-sm font-medium text-ink">{q.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
