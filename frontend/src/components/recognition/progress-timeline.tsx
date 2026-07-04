import * as React from "react";
import type { ApplicationStatus } from "@/types/recognition";

interface Stage {
  label: string;
  note?: string;
}

const STAGES: Stage[] = [
  { label: "提交申请", note: "学生提交困难认定申请" },
  { label: "班级评审", note: "班主任 / 辅导员审核" },
  { label: "教学系评审", note: "教学系经办人审核" },
  { label: "院级评审", note: "资助中心审核（终审）" },
  { label: "认定通过", note: "可发起助学金申请" },
];

// 由状态推导“当前进行到的阶段下标”（STAGES 索引）。
function activeIndex(status: ApplicationStatus): number {
  switch (status) {
    case "draft":
      return -1; // 尚未提交
    case "pending_class":
      return 1;
    case "pending_dept":
      return 2;
    case "pending_college":
    case "pending_final": // 兼容历史数据，视同院级评审中
      return 3;
    case "approved":
      return 4; // 全部完成
    case "rejected":
      return 0; // 退回到学生
    default:
      return -1;
  }
}

type DotState = "done" | "active" | "pending";

export function ProgressTimeline({
  status,
  rejectReason,
}: {
  status: ApplicationStatus;
  rejectReason?: string;
}) {
  const active = activeIndex(status);

  const dotState = (i: number): DotState => {
    if (active < 0) return i === 0 ? "active" : "pending";
    if (i < active) return "done";
    if (i === active) return "active";
    return "pending";
  };

  const dotColor: Record<DotState, React.CSSProperties> = {
    done: { backgroundColor: "var(--state-success)" },
    active: { backgroundColor: "var(--color-primary)" },
    pending: {
      backgroundColor: "var(--color-bg-page)",
      border: "1.5px solid var(--color-border)",
    },
  };

  return (
    <div className="flex flex-col gap-5">
      {status === "rejected" && rejectReason && (
        <div
          className="rounded-md px-3 py-2 text-xs"
          style={{
            background: "var(--state-error-bg)",
            color: "var(--state-error)",
          }}
        >
          退回原因：{rejectReason}
        </div>
      )}
      {status === "draft" && (
        <p className="text-xs text-ink-mute">尚未提交，提交后开始逐级评审。</p>
      )}
      {STAGES.map((stage, i) => {
        const state = dotState(i);
        const last = i === STAGES.length - 1;
        return (
          <div key={stage.label} className="relative flex gap-3">
            {!last && (
              <span
                className="absolute"
                style={{
                  left: 7,
                  top: 18,
                  bottom: -20,
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
                ...dotColor[state],
              }}
            />
            <div className="flex flex-col gap-0.5">
              <span
                className="text-sm"
                style={{
                  fontWeight: state === "pending" ? 400 : 500,
                  color:
                    state === "pending"
                      ? "var(--color-text-muted)"
                      : "var(--color-text-primary)",
                }}
              >
                {stage.label}
              </span>
              {stage.note && (
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {state === "active" ? `${stage.note}（进行中）` : stage.note}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
