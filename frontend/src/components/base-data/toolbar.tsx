import * as React from "react";

// 数据管理页统一工具栏卡片：左侧搜索/筛选，右侧操作按钮。
export function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4"
      style={{
        backgroundColor: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
      }}
    >
      {children}
    </div>
  );
}
