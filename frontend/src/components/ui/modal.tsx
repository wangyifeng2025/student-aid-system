"use client";

import * as React from "react";
import { X } from "lucide-react";

type ModalSize = "md" | "lg" | "xl";

const sizeClass: Record<ModalSize, string> = {
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  /** 为 false 时禁止遮罩、ESC、右上角关闭（长任务进行中）。 */
  closable?: boolean;
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = "md",
  closable = true,
}: ModalProps) {
  React.useEffect(() => {
    if (!open || !closable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, closable]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 23, 42, 0.45)" }}
      onClick={closable ? onClose : undefined}
      role="presentation"
    >
      <div
        className={`max-h-[90vh] w-full ${sizeClass[size]} overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-float)]`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {closable ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-ink-mute transition-colors hover:bg-page hover:text-ink-soft"
            >
              <X size={16} />
            </button>
          ) : (
            <span className="h-7 w-7" aria-hidden />
          )}
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
