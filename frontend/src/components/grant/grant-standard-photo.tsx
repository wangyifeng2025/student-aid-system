"use client";

import * as React from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { attachmentApi, grantApi, ApiError } from "@/lib/api";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import type { Attachment } from "@/types/recognition";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = ".jpg,.jpeg,.png,image/jpeg,image/png";

export interface GrantPhotoState {
  /** 照片接口已可用（区别于路由尚未部署）。 */
  available: boolean;
  hasPhoto: boolean;
  loading: boolean;
}

interface Props {
  grantId: number;
  editable: boolean;
  onStateChange?: (state: GrantPhotoState) => void;
}

function isAllowedPhoto(file: File): boolean {
  if (file.type === "image/jpeg" || file.type === "image/png") return true;
  return /\.(jpe?g|png)$/i.test(file.name);
}

export function GrantStandardPhoto({ grantId, editable, onStateChange }: Props) {
  const [photo, setPhoto] = React.useState<Attachment | null>(null);
  const [available, setAvailable] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const onStateChangeRef = React.useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await grantApi.getStandardPhoto(grantId);
      setAvailable(res.available);
      setPhoto(res.attachment);
    } catch (e) {
      setAvailable(false);
      setPhoto(null);
      toast.error(e instanceof ApiError ? e.message : "加载标准照片失败");
    } finally {
      setLoading(false);
    }
  }, [grantId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    onStateChangeRef.current?.({
      available,
      hasPhoto: photo !== null,
      loading,
    });
  }, [available, photo, loading]);

  React.useEffect(() => {
    if (!photo) {
      setPreviewUrl(null);
      return;
    }
    let revoked = false;
    let url: string | null = null;
    void attachmentApi
      .fetchBlob(photo.id)
      .then((blob) => {
        if (revoked) return;
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      })
      .catch(() => {
        if (!revoked) setPreviewUrl(null);
      });
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo]);

  const upload = async (file: File) => {
    if (!isAllowedPhoto(file)) {
      toast.error("请上传 JPG 或 PNG 格式的标准照片");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("标准照片不能超过 2MB");
      return;
    }
    setBusy(true);
    try {
      const saved = await grantApi.uploadStandardPhoto(grantId, file);
      setPhoto(saved);
      setAvailable(true);
      toast.success(photo ? "已更换标准照片" : "已上传标准照片");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "上传失败");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await grantApi.removeStandardPhoto(grantId);
      setPhoto(null);
      toast.success("已删除标准照片");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div className="relative flex h-[168px] w-[120px] items-center justify-center overflow-hidden rounded-md border border-dashed border-line bg-page">
        {loading || busy ? (
          <Loader2 size={18} className="animate-spin text-ink-mute" />
        ) : previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="标准照片" className="h-full w-full object-cover" />
        ) : (
          <div className="px-2 text-center text-xs leading-5 text-ink-mute">
            <ImagePlus size={18} className="mx-auto mb-1" />
            标准照片
          </div>
        )}
      </div>
      <p className="max-w-[148px] text-center text-[11px] leading-4 text-ink-mute">
        免冠证件照，白底或蓝底，JPG/PNG，不超过 2MB
      </p>
      {editable && (
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || loading}
            onClick={() => inputRef.current?.click()}
          >
            {photo ? "更换" : "上传"}
          </Button>
          {photo && (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void remove()}>
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      )}
      {!editable && !loading && !photo && (
        <p className="text-[11px] text-ink-mute">未上传</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
