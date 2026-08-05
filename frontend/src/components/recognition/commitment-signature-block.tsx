"use client";

import { SignaturePad } from "@/components/recognition/signature-pad";
import { COMMITMENT_HANDWRITE_TEXT } from "@/lib/signature";

type Props = {
  commitmentDataUrl: string;
  signatureDataUrl: string;
  onCommitmentChange: (dataUrl: string) => void;
  onSignatureChange: (dataUrl: string) => void;
  disabled?: boolean;
};

/**
 * 对照纸质「个人承诺」表格布局：
 * 左栏手写承诺正文，右栏学生本人（或监护人）签字。
 * 窄屏自动上下堆叠。
 */
export function CommitmentSignatureBlock({
  commitmentDataUrl,
  signatureDataUrl,
  onCommitmentChange,
  onSignatureChange,
  disabled,
}: Props) {
  return (
    <div
      className="overflow-hidden rounded-md"
      style={{ border: "1px solid var(--color-border)" }}
    >
      <div
        className="px-3 py-2 text-sm font-semibold text-ink"
        style={{
          background: "var(--color-bg-page)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        个人承诺（须手写）
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* 承诺内容 */}
        <div
          className="p-3 md:border-r"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="mb-2 text-xs font-semibold text-ink">承诺内容：</div>
          <p className="mb-2 text-xs leading-5" style={{ color: "var(--state-error)" }}>
            （此处手写：「{COMMITMENT_HANDWRITE_TEXT}」）
          </p>
          <SignaturePad
            value={commitmentDataUrl}
            onChange={onCommitmentChange}
            height={150}
            placeholder="请在此手写完整承诺内容"
            disabled={disabled}
          />
        </div>

        {/* 签字 */}
        <div className="border-t p-3 md:border-t-0" style={{ borderColor: "var(--color-border)" }}>
          <div className="mb-2 text-xs font-semibold text-ink">
            学生本人（或监护人）签字
          </div>
          <p className="mb-2 text-xs leading-5" style={{ color: "var(--color-text-muted)" }}>
            （此处手写签字）
          </p>
          <SignaturePad
            value={signatureDataUrl}
            onChange={onSignatureChange}
            height={150}
            placeholder="请在此签字"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
