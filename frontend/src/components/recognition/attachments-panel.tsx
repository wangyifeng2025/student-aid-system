"use client";

import * as React from "react";
import { Eye, FileText, Image as ImageIcon, Upload, Trash2, Download } from "lucide-react";
import { recognitionApi, attachmentApi, ApiError } from "@/lib/api";
import { isSignatureAttachment } from "@/lib/signature";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { LoadingState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Attachment } from "@/types/recognition";

const MAX_PROOF_FILES = 8;
const ACCEPT = ".pdf,.jpg,.jpeg,.png";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(mime: string, name: string): boolean {
  return mime.startsWith("image/") || /\.(png|jpe?g)$/i.test(name);
}

function isPdf(mime: string, name: string): boolean {
  return mime === "application/pdf" || /\.pdf$/i.test(name);
}

function isAllowedProofFile(name: string): boolean {
  return /\.(pdf|jpe?g|png)$/i.test(name);
}

interface Props {
  recognitionId: number;
  // 是否允许上传/删除（仅本人草稿或被退回状态）。
  editable: boolean;
  /** 勾选低收入相关类型时为 true，用于展示必填提示。 */
  required?: boolean;
  onCountChange?: (count: number) => void;
}

export function AttachmentsPanel({ recognitionId, editable, required, onCountChange }: Props) {
  const [items, setItems] = React.useState<Attachment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Attachment | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [preview, setPreview] = React.useState<Attachment | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const onCountChangeRef = React.useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await recognitionApi.listAttachments(recognitionId);
      // 手写承诺/签字图由专用签字区管理，不混入支撑材料列表。
      const proofs = res.filter((a) => !isSignatureAttachment(a.file_name));
      setItems(proofs);
      onCountChangeRef.current?.(proofs.length);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "加载附件失败");
    } finally {
      setLoading(false);
    }
  }, [recognitionId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!preview) {
      setPreviewUrl(null);
      return;
    }
    let objectUrl = "";
    let cancelled = false;
    setPreviewLoading(true);
    void (async () => {
      try {
        const blob = await attachmentApi.fetchBlob(preview.id);
        if (cancelled) return;
        const mime = isPdf(preview.mime, preview.file_name)
          ? "application/pdf"
          : isImage(preview.mime, preview.file_name)
            ? blob.type && blob.type.startsWith("image/")
              ? blob.type
              : "image/jpeg"
            : blob.type || "application/octet-stream";
        objectUrl = URL.createObjectURL(blob.type === mime ? blob : new Blob([blob], { type: mime }));
        setPreviewUrl(objectUrl);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof ApiError ? e.message : "预览失败");
          setPreview(null);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [preview]);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重复选择同名文件
    if (!file) return;
    if (!isAllowedProofFile(file.name)) {
      toast.error("仅支持 JPG、PNG 图片或 PDF");
      return;
    }
    if (items.length >= MAX_PROOF_FILES) {
      toast.error(`最多上传 ${MAX_PROOF_FILES} 份证明材料`);
      return;
    }
    setUploading(true);
    try {
      await recognitionApi.uploadAttachment(recognitionId, file);
      toast.success("附件已上传");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (a: Attachment) => {
    try {
      await attachmentApi.download(a.id, a.file_name);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "下载失败");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await attachmentApi.remove(deleteTarget.id);
      toast.success("附件已删除");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const closePreview = () => setPreview(null);

  return (
    <div>
      {editable && (
        <div className="mb-3">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleFile}
            accept={ACCEPT}
          />
          <Button variant="outline" size="sm" onClick={handlePick} disabled={uploading}>
            <Upload size={16} />
            {uploading ? "上传中…" : "上传附件"}
          </Button>
          <p className="mt-1.5 text-xs text-ink-mute">
            {required
              ? "低收入家庭须上传至少一份证明材料（低保证、特困证等），仅支持 JPG / PNG / PDF。"
              : "可上传低保证、特困证等支撑材料，仅支持 JPG / PNG / PDF。"}
          </p>
        </div>
      )}

      {loading ? (
        <LoadingState label="加载附件…" />
      ) : items.length === 0 ? (
        <p className="py-4 text-sm text-ink-mute">
          {required ? "尚未上传证明材料，勾选低收入相关类型后提交前须至少上传一份。" : "暂无证明材料。"}
        </p>
      ) : (
        <div className="flex flex-col">
          {items.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors hover:bg-page"
            >
              {isImage(a.mime, a.file_name) ? (
                <ImageIcon size={16} className="shrink-0" style={{ color: "var(--state-warning)" }} />
              ) : (
                <FileText size={16} className="shrink-0" style={{ color: "var(--color-primary)" }} />
              )}
              <span className="min-w-0 flex-1 truncate text-ink" title={a.file_name}>
                {a.file_name}
              </span>
              <span className="shrink-0 text-xs text-ink-mute">{humanSize(a.size)}</span>
              <button
                type="button"
                onClick={() => setPreview(a)}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-link hover:underline"
              >
                <Eye size={14} />
                预览
              </button>
              <button
                type="button"
                onClick={() => handleDownload(a)}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-link hover:underline"
              >
                <Download size={14} />
                下载
              </button>
              {editable && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(a)}
                  className="inline-flex shrink-0 items-center text-xs font-medium hover:underline"
                  style={{ color: "var(--state-error)" }}
                  aria-label="删除附件"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={preview !== null} title={preview?.file_name ?? "预览"} onClose={closePreview} size="xl">
        {previewLoading || !previewUrl ? (
          <LoadingState label="加载预览…" />
        ) : preview && isPdf(preview.mime, preview.file_name) ? (
          <iframe
            title={preview.file_name}
            src={previewUrl}
            className="h-[65vh] w-full rounded-sm border border-line bg-page"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={preview?.file_name ?? "证明材料"}
            className="mx-auto max-h-[65vh] w-auto max-w-full object-contain"
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除附件"
        description={`确定删除「${deleteTarget?.file_name}」吗？该操作不可撤销。`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
