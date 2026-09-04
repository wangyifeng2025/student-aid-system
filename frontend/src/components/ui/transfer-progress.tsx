"use client";

import { formatElapsed } from "@/hooks/use-elapsed";

interface TransferProgressProps {
  percent: number;
  elapsed: number;
  title: string;
  hint: string;
  detail?: string;
}

export function TransferProgress({
  percent,
  elapsed,
  title,
  hint,
  detail,
}: TransferProgressProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const indeterminate = clamped < 2;

  return (
    <div
      className="rounded-md border border-line px-4 py-3.5"
      style={{ background: "var(--color-primary-subtle)" }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="shrink-0 text-xs tabular-nums text-ink-mute">已用时 {formatElapsed(elapsed)}</p>
      </div>
      <div
        className="relative h-2 overflow-hidden rounded-full"
        style={{ background: "var(--color-border-light, #e2e8f0)" }}
      >
        {indeterminate ? (
          <span className="transfer-progress-indeterminate absolute inset-y-0 w-1/3 rounded-full bg-brand" />
        ) : (
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-brand transition-[width] duration-300"
            style={{ width: `${clamped}%` }}
          />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-ink-soft">{hint}</p>
        {!indeterminate && (
          <span className="shrink-0 text-xs tabular-nums font-medium text-brand">{clamped}%</span>
        )}
      </div>
      {detail ? <p className="mt-1 truncate text-xs text-ink-mute">{detail}</p> : null}
      <style>{`
        @keyframes transfer-progress-slide {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
        .transfer-progress-indeterminate {
          animation: transfer-progress-slide 1.15s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
