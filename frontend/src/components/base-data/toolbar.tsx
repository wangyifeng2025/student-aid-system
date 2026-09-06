import * as React from "react";

// 数据管理页统一工具栏卡片：支持两行布局。
// 第一行：查询 / 筛选条件；第二行：导入 / 导出 / 删除 / 新增等操作按钮。
// 每个直接子元素作为一行，自动换行。
export function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-4 flex flex-col gap-3 p-4"
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
