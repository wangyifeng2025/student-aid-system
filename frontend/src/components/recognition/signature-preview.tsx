"use client";

import * as React from "react";
import { loadSignatureDataUrls } from "@/lib/signature-upload";
import { COMMITMENT_HANDWRITE_TEXT } from "@/lib/signature";
import { LoadingState } from "@/components/ui/states";

type Props = {
  recognitionId: number;
};

/**
 * 只读展示印刷承诺 + 手写签字（历史手写承诺图若存在则一并展示）。
 */
export function SignaturePreview({ recognitionId }: Props) {
  const [commitment, setCommitment] = React.useState("");
  const [signature, setSignature] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await loadSignatureDataUrls(recognitionId);
        if (!cancelled) {
          setCommitment(res.commitment);
          setSignature(res.signature);
        }
      } catch {
        // 签字附件缺失（如草稿阶段）时静默忽略。
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recognitionId]);

  if (loading) return <LoadingState label="加载签字信息…" />;

  if (!signature && !commitment) {
    return <p className="py-4 text-sm text-ink-mute">暂无签字信息（可能仍为草稿，尚未提交）。</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <div className="mb-2 text-xs font-semibold text-ink">承诺内容</div>
        <div
          className="mb-2 rounded-md border px-3 py-3 text-sm leading-6 text-ink"
          style={{ borderColor: "var(--color-border)", background: "var(--color-bg-page)" }}
        >
          {COMMITMENT_HANDWRITE_TEXT}
        </div>
        {commitment ? (
          <>
            <p className="mb-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
              历史手写承诺（旧版申请）：
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={commitment}
              alt="历史手写承诺"
              className="w-full rounded-md border object-contain"
              style={{ borderColor: "var(--color-border)", background: "#fafafa", maxHeight: 160 }}
            />
          </>
        ) : null}
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold text-ink">学生本人（或监护人）签字</div>
        {signature ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signature}
            alt="学生本人（或监护人）签字"
            className="w-full rounded-md border object-contain"
            style={{ borderColor: "var(--color-border)", background: "#fafafa", maxHeight: 200 }}
          />
        ) : (
          <p className="text-sm text-ink-mute">未提供</p>
        )}
      </div>
    </div>
  );
}
