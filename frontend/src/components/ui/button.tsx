import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand text-ink-inverse hover:bg-brand-hover active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none",
  outline:
    "border border-brand bg-transparent text-brand hover:bg-brand-subtle disabled:opacity-60 disabled:pointer-events-none",
  ghost:
    "bg-transparent text-ink-soft hover:bg-page disabled:opacity-60 disabled:pointer-events-none",
  danger:
    "bg-transparent border border-line text-error hover:bg-[var(--state-error-bg)] disabled:opacity-60 disabled:pointer-events-none",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-[0.9375rem] gap-2",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-[background-color,transform,border-color] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand-light",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
