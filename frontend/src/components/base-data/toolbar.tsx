import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// 数据管理页统一工具栏卡片：支持两行布局。
// 第一行：查询 / 筛选条件；第二行：导入 / 导出 / 删除 / 新增等操作按钮。
// 每个直接子元素作为一行，自动换行。
export function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-4 flex flex-col gap-2.5 p-3"
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

/** 筛选行：单行紧凑，过窄时横向滚动。 */
export function ToolbarFilters({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** 操作行：导入 / 导出 / 删除 / 新增。 */
export function ToolbarActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {children}
    </div>
  );
}

/** 带搜索图标的紧凑关键词输入。 */
export function ToolbarSearch({
  value,
  onChange,
  onSubmit,
  placeholder,
  widthClassName = "w-44",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  widthClassName?: string;
}) {
  return (
    <div className={cn("relative shrink-0", widthClassName)}>
      <Search
        size={14}
        className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-ink-mute"
      />
      <Input
        compact
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.();
        }}
        placeholder={placeholder}
        className="pl-7"
      />
    </div>
  );
}
