"use client";

import * as React from "react";
import { FileText, Image as ImageIcon, Upload, Trash2, Download } from "lucide-react";
import { recognitionApi, attachmentApi, ApiError } from "@/lib/api";
import { isSignatureAttachment } from "@/lib/signature";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Attachment } from "@/types/recognition";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(mime: string, name: string): boolean {
  return mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
}

interface Props {
  recognitionId: number;
  // 是否允许上传/删除（仅本人草稿或被退回状态）。
  editable: boolean;
}

export function AttachmentsPanel({ recognitionId, editable }: Props) {
  const [items, setItems] = React.useState<Attachment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Attachment | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await recognitionApi.listAttachments(recognitionId);
      // 手写承诺/签字图由专用签字区管理，不混入支撑材料列表。
      setItems(res.filter((a) => !isSignatureAttachment(a.file_name)));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "加载附件失败");
    } finally {
      setLoading(false);
    }
  }, [recognitionId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重复选择同名文件
    if (!file) return;
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

  return (
    <div>
      {editable && (
        <div className="mb-3">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleFile}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx"
          />
          <Button variant="outline" size="sm" onClick={handlePick} disabled={uploading}>
            <Upload size={16} />
            {uploading ? "上传中…" : "上传附件"}
          </Button>
          <p className="mt-1.5 text-xs text-ink-mute">
            支持 PDF / 图片 / Office 文档，单个文件不超过服务端限制。
          </p>
        </div>
      )}

      {loading ? (
        <LoadingState label="加载附件…" />
      ) : items.length === 0 ? (
        <p className="py-4 text-sm text-ink-mute">暂无附件材料。</p>
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
