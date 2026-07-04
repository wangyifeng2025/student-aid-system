import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-md border border-line bg-surface px-3 text-[0.9375rem] text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-mute",
          "focus:border-brand focus:ring-2 focus:ring-brand-light",
          className,
        )}
        {...props}
      />
    );
  },
);
