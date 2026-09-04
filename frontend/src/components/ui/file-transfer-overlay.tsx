"use client";

import { TransferProgress } from "@/components/ui/transfer-progress";
import { estimatedPercent, useElapsed } from "@/hooks/use-elapsed";

interface FileTransferOverlayProps {
  open: boolean;
  title: string;
  hint: string;
  /** 预计耗时尺度（秒），越大进度涨得越慢。 */
  tauSeconds?: number;
}

/** 全屏遮罩：导出/导入等长请求期间提示用户不要关闭页面。 */
export function FileTransferOverlay({
  open,
  title,
  hint,
  tauSeconds = 20,
}: FileTransferOverlayProps) {
  const elapsed = useElapsed(open);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(15, 23, 42, 0.45)" }}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-[var(--shadow-float)]">
        <TransferProgress
          percent={estimatedPercent(elapsed, tauSeconds)}
          elapsed={elapsed}
          title={title}
          hint={hint}
        />
      </div>
    </div>
  );
}
