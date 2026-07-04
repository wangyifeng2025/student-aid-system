import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  difficultyLabel,
  levelName,
  reviewActionLabel,
  rejectTargetLabel,
} from "@/lib/recognition-options";
import type { ReviewRecord } from "@/types/recognition";

function formatTime(value: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReviewLog({ records }: { records: ReviewRecord[] }) {
  if (!records || records.length === 0) {
    return <p className="text-sm text-ink-mute">暂无评审流转记录。</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {records.map((r, i) => {
        const pass = r.action === "pass";
        const last = i === records.length - 1;
        return (
          <div key={r.id || i} className="relative flex gap-3">
            {!last && (
              <span
                className="absolute"
                style={{
                  left: 7,
                  top: 18,
                  bottom: -16,
                  width: 1.5,
                  backgroundColor: "var(--color-border)",
                }}
              />
            )}
            <span
              className="mt-0.5 shrink-0"
              style={{
                width: 16,
                height: 16,
                borderRadius: "var(--radius-full)",
                backgroundColor: pass
                  ? "var(--state-success)"
                  : "var(--state-error)",
              }}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink">
                  {levelName(r.level)}
                </span>
                <Badge tone={pass ? "success" : "error"}>
                  {reviewActionLabel(r.action)}
                </Badge>
                {pass && r.difficulty_level && (
                  <span className="text-xs text-ink-soft">
                    定档：{difficultyLabel(r.difficulty_level)}
                  </span>
                )}
                {!pass && (
                  <span className="text-xs text-ink-soft">
                    退回至：{rejectTargetLabel(r.reject_to_level)}
                  </span>
                )}
              </div>
              {r.opinion && (
                <p className="text-sm text-ink-soft">{r.opinion}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-ink-mute">
                <span>{r.reviewer_name || `评审人 #${r.reviewer_id}`}</span>
                <span>·</span>
                <span className="tabular-nums">{formatTime(r.created_at)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
