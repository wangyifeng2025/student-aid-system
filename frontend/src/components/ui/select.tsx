import * as React from "react";
import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  /** 工具栏一行筛选用：更矮、更紧。 */
  compact?: boolean;
  /** 按当前选中文字撑开宽度，避免筛选项被裁切。 */
  fitContent?: boolean;
};

const chevron =
  "appearance-none bg-no-repeat bg-[length:0.75rem] bg-[position:right_0.45rem_center] bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%2364758b' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")]";

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, children, compact = false, fitContent = false, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "cursor-pointer rounded-sm border border-line bg-surface text-ink outline-none transition-colors duration-150",
          chevron,
          // 默认固定为 className 给定的宽度，避免被最长 option 撑开。
          // fitContent 只按当前选中项展开，选中后仍能看全文字。
          fitContent ? "w-auto shrink-0 field-sizing-content" : "min-w-0 field-sizing-fixed",
          "focus:border-brand focus:ring-2 focus:ring-brand-light",
          compact ? "h-8 py-0 pr-7 pl-2 text-xs" : "h-11 pr-8 pl-2.5 text-base md:h-10 md:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
