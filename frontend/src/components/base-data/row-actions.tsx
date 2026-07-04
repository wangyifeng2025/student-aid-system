interface RowActionsProps {
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function RowActions({ canWrite, onEdit, onDelete }: RowActionsProps) {
  if (!canWrite) {
    return <span className="text-ink-mute">—</span>;
  }
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onEdit}
        className="text-sm text-link transition-colors hover:underline"
      >
        编辑
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="text-sm transition-colors hover:underline"
        style={{ color: "var(--state-error)" }}
      >
        删除
      </button>
    </div>
  );
}
