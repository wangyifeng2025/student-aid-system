"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useToastStore, type ToastTone } from "@/store/toast";

const toneConfig: Record<
  ToastTone,
  { icon: typeof Info; color: string; bg: string }
> = {
  success: {
    icon: CheckCircle2,
    color: "var(--state-success)",
    bg: "var(--state-success-bg)",
  },
  error: { icon: XCircle, color: "var(--state-error)", bg: "var(--state-error-bg)" },
  info: { icon: Info, color: "var(--state-info)", bg: "var(--state-info-bg)" },
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const cfg = toneConfig[t.tone];
        const Icon = cfg.icon;
        return (
          <div
            key={t.id}
            role="status"
            onClick={() => dismiss(t.id)}
            className="flex cursor-pointer items-start gap-2.5 rounded-md border bg-surface px-4 py-3 text-sm shadow-[var(--shadow-elevated)]"
            style={{ borderColor: cfg.color }}
          >
            <Icon size={18} style={{ color: cfg.color }} className="mt-0.5 shrink-0" />
            <span className="text-ink">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
