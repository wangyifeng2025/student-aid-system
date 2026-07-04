import * as React from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "success" | "warning" | "error" | "info" | "brand";

const toneStyles: Record<Tone, React.CSSProperties> = {
  neutral: { background: "var(--color-bg-page)", color: "var(--color-text-muted)" },
  success: { background: "var(--state-success-bg)", color: "var(--state-success)" },
  warning: { background: "var(--state-warning-bg)", color: "var(--state-warning)" },
  error: { background: "var(--state-error-bg)", color: "var(--state-error)" },
  info: { background: "var(--state-info-bg)", color: "var(--state-info)" },
  brand: { background: "var(--color-primary-subtle)", color: "var(--color-primary)" },
};

interface BadgeProps {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ tone = "neutral", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={toneStyles[tone]}
    >
      {children}
    </span>
  );
}
