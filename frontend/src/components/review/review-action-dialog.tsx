"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DIFFICULTY_OPTIONS, rejectTargetOptions } from "@/lib/recognition-options";
import type { ReviewActionInput, ReviewActionType } from "@/types/recognition";

interface ReviewActionDialogProps {
  open: boolean;
  action: ReviewActionType;
  currentLevel: number; // 当前评审级别（1~4），用于退回目标可选项
  // 班级评审通过时须初定困难等级
  requireDifficulty?: boolean;
  // 已有困难等级（高层级通过时默认带入，可调整）
  defaultDifficulty?: string;
  loading?: boolean;
  onConfirm: (input: ReviewActionInput) => void;
  onCancel: () => void;
}

export function ReviewActionDialog({
  open,
  action,
  currentLevel,
  requireDifficulty,
  defaultDifficulty = "",
  loading,
  onConfirm,
  onCancel,
}: ReviewActionDialogProps) {
  const isPass = action === "pass";
  const [difficulty, setDifficulty] = React.useState(defaultDifficulty);
  const [opinion, setOpinion] = React.useState("");
  const targets = React.useMemo(
    () => rejectTargetOptions(currentLevel),
    [currentLevel],
  );
  const [rejectTo, setRejectTo] = React.useState(
    targets.length > 0 ? targets[0].value : "0",
  );
  const [error, setError] = React.useState<string | null>(null);

  // 每次打开时重置表单
  React.useEffect(() => {
    if (open) {
      setDifficulty(defaultDifficulty);
      setOpinion("");
      setRejectTo(targets.length > 0 ? targets[0].value : "0");
      setError(null);
    }
  }, [open, defaultDifficulty, targets]);

  const handleConfirm = () => {
    if (isPass) {
      if (requireDifficulty && !difficulty) {
        setError("班级评审通过时须初定困难等级");
        return;
      }
      onConfirm({
        difficulty_level: difficulty || undefined,
        opinion: opinion.trim() || undefined,
      });
    } else {
      if (!opinion.trim()) {
        setError("退回时必须填写退回意见");
        return;
      }
      onConfirm({
        reject_to_level: Number(rejectTo),
        opinion: opinion.trim(),
      });
    }
  };

  return (
    <Modal
      open={open}
      title={isPass ? "通过评审" : "退回申请"}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button
            variant={isPass ? "primary" : "danger"}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "处理中…" : isPass ? "确认通过" : "确认退回"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {isPass && (
          <div>
            <Label htmlFor="review-difficulty">
              困难等级{requireDifficulty ? "（必填）" : "（可调整）"}
            </Label>
            <Select
              id="review-difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full"
            >
              <option value="">{requireDifficulty ? "请选择困难等级" : "维持现有等级"}</option>
              {DIFFICULTY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        )}

        {!isPass && (
          <div>
            <Label htmlFor="review-reject-to">退回对象</Label>
            <Select
              id="review-reject-to"
              value={rejectTo}
              onChange={(e) => setRejectTo(e.target.value)}
              className="w-full"
            >
              {targets.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <Label htmlFor="review-opinion">
            {isPass ? "评审意见（可选）" : "退回意见（必填）"}
          </Label>
          <textarea
            id="review-opinion"
            value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
            rows={4}
            placeholder={
              isPass
                ? "可填写评审意见，留空则不记录意见"
                : "请说明退回原因，便于下级或学生修改"
            }
            className="w-full rounded-sm border border-line bg-surface px-2.5 py-2 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-light"
          />
        </div>

        {error && (
          <p
            className="rounded-md px-3 py-2 text-xs"
            style={{ background: "var(--state-error-bg)", color: "var(--state-error)" }}
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
