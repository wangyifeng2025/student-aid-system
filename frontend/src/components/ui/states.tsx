import { Loader2, Inbox, AlertCircle } from "lucide-react";

export function LoadingState({ label = "加载中…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-mute">
      <Loader2 size={18} className="animate-spin" />
      {label}
    </div>
  );
}

export function EmptyState({ label = "暂无数据" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-ink-mute">
      <Inbox size={28} strokeWidth={1.5} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({
  label = "加载失败",
  onRetry,
}: {
  label?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-ink-mute">
      <AlertCircle size={28} strokeWidth={1.5} style={{ color: "var(--state-error)" }} />
      <p className="text-sm">{label}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm text-link hover:underline"
        >
          重试
        </button>
      )}
    </div>
  );
}
