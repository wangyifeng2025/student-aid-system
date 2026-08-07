"use client";

import * as React from "react";
import { loadSignatureDataUrls } from "@/lib/signature-upload";
import { COMMITMENT_HANDWRITE_TEXT } from "@/lib/signature";
import { LoadingState } from "@/components/ui/states";

type Props = {
  recognitionId: number;
};

/**
 * 只读展示已提交的手写承诺 / 签字图片（学生查看进度、教师审核详情页复用）。
 * 附件缺失（如仍是草稿）时静默显示「暂无」，不视为错误。
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

  if (!commitment && !signature) {
    return <p className="py-4 text-sm text-ink-mute">暂无手写签字信息（可能仍为草稿，尚未提交）。</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <div className="mb-2 text-xs font-semibold text-ink">承诺内容（手写）</div>
        <p className="mb-2 text-xs leading-5" style={{ color: "var(--color-text-muted)" }}>
          「{COMMITMENT_HANDWRITE_TEXT}」
        </p>
        {commitment ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={commitment}
            alt="个人承诺手写内容"
            className="w-full rounded-md border object-contain"
            style={{ borderColor: "var(--color-border)", background: "#fafafa", maxHeight: 200 }}
          />
        ) : (
          <p className="text-sm text-ink-mute">未提供</p>
        )}
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
