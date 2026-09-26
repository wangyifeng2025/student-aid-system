"use client";

export interface StatTabItem {
  value: string;
  label: string;
  count?: number;
}

interface StatTabBarProps {
  items: StatTabItem[];
  active: string;
  onChange: (value: string) => void;
  loading?: boolean;
}

/**
 * 审核页签：连成一条，选中项实心主色，数字为小徽章。
 */
export function StatTabBar({ items, active, onChange, loading }: StatTabBarProps) {
  return (
    <div
      role="tablist"
      className="mb-3 inline-flex max-w-full flex-wrap overflow-hidden"
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        backgroundColor: "var(--color-bg-card)",
      }}
    >
      {items.map((item, index) => {
        const isActive = active === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.value)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm"
            style={{
              backgroundColor: isActive ? "var(--color-primary)" : "transparent",
              color: isActive ? "#fff" : "var(--color-text-secondary)",
              fontWeight: isActive ? 600 : 500,
              borderLeft: index === 0 ? "none" : "1px solid var(--color-border)",
              cursor: "pointer",
            }}
          >
            <span>{item.label}</span>
            <span
              className="min-w-5 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums"
              style={{
                backgroundColor: isActive ? "rgba(255,255,255,0.22)" : "var(--color-bg-page)",
                color: isActive ? "#fff" : "var(--color-text-primary)",
              }}
            >
              {loading ? "—" : (item.count ?? 0).toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
