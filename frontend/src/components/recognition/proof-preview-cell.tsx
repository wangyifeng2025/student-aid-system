"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { AttachmentsPanel } from "@/components/recognition/attachments-panel";
import { Modal } from "@/components/ui/modal";

type Props = {
  recognitionId: number;
  count: number;
  studentName?: string;
};

export function ProofPreviewCell({ recognitionId, count, studentName }: Props) {
  const [open, setOpen] = React.useState(false);
  const title = studentName ? `${studentName} · 证明材料` : "证明材料";

  if (!count) {
    return <span className="text-ink-mute">无</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline"
      >
        <Eye size={14} />
        预览（{count}）
      </button>
      <Modal open={open} title={title} onClose={() => setOpen(false)} size="xl">
        <AttachmentsPanel recognitionId={recognitionId} editable={false} />
      </Modal>
    </>
  );
}
