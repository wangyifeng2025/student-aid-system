"use client";

export interface StatTabItem {
  value: string;
  label: string;
  count?: number;
  /** 左侧色条，如 var(--color-primary) */
  accentColor: string;
}

interface StatTabBarProps {
  items: StatTabItem[];
  active: string;
  onChange: (value: string) => void;
  loading?: boolean;
}

/**
 * 统计标签栏：借鉴待办审核页设计，左侧色条 + 标签 + 数量，可点击切换。
 */
export function StatTabBar({ items, active, onChange, loading }: StatTabBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {items.map((item) => {
        const isActive = active === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className="flex items-center gap-2 px-3 py-2 text-sm transition-colors"
            style={{
              backgroundColor: isActive ? "var(--color-primary-subtle)" : "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderLeft: `3px solid ${item.accentColor}`,
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
            }}
          >
            <span style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-secondary)" }}>
              {item.label}
            </span>
            <span
              className="font-semibold tabular-nums"
              style={{ color: "var(--color-text-primary)" }}
            >
              {loading ? "—" : (item.count ?? 0)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
