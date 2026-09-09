import * as React from "react";
import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  /** 工具栏一行筛选用：更矮、更紧。 */
  compact?: boolean;
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, children, compact = false, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "cursor-pointer rounded-sm border border-line bg-surface text-ink outline-none transition-colors duration-150",
          // 固定为 className 给定的宽度，避免被最长 option 撑开后换行。
          "min-w-0 field-sizing-fixed",
          "focus:border-brand focus:ring-2 focus:ring-brand-light",
          compact ? "h-8 px-2 pr-6 text-xs" : "h-11 pr-8 pl-2.5 text-base md:h-10 md:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
