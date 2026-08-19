"use client";

import { SignaturePad } from "@/components/recognition/signature-pad";
import { COMMITMENT_HANDWRITE_TEXT } from "@/lib/signature";

type Props = {
  signatureDataUrl: string;
  onSignatureChange: (dataUrl: string) => void;
  disabled?: boolean;
};

/**
 * 印刷承诺正文 + 仅手写签字（勾选同意在外层表单完成）。
 */
export function CommitmentSignatureBlock({
  signatureDataUrl,
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
        个人承诺与签字
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="p-3 md:border-r" style={{ borderColor: "var(--color-border)" }}>
          <div className="mb-2 text-xs font-semibold text-ink">承诺内容：</div>
          <div
            className="mb-2 rounded-md border px-3 py-3 text-sm leading-6 font-medium text-ink"
            style={{ borderColor: "var(--color-border)", background: "var(--color-bg-page)" }}
          >
            {COMMITMENT_HANDWRITE_TEXT}
          </div>
          <p className="text-xs leading-5" style={{ color: "var(--color-text-muted)" }}>
            请仔细阅读上述承诺，在右侧手写签字并勾选同意。
          </p>
        </div>

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
