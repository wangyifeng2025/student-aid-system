import * as React from "react";
import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-9 cursor-pointer rounded-sm border border-line bg-surface pr-7 pl-2.5 text-sm text-ink outline-none transition-colors duration-150",
          "focus:border-brand focus:ring-2 focus:ring-brand-light",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
