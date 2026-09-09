import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** 工具栏一行筛选用：更矮、更紧。 */
  compact?: boolean;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, compact = false, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-md border border-line bg-surface text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-mute",
          "focus:border-brand focus:ring-2 focus:ring-brand-light",
          compact
            ? "h-8 px-2 text-xs"
            : "h-11 px-3 text-base md:h-10 md:text-[0.9375rem]",
          className,
        )}
        {...props}
      />
    );
  },
);
