"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Column } from "@/components/base-data/data-table";

/**
 * 生成表格首列复选框列定义（用于批量选择）。
 */
export function checkboxColumn<T>(
  selected: Set<number>,
  allSelected: boolean,
  toggleAll: () => void,
  toggleRow: (id: number) => void,
  getId: (item: T) => number,
  ariaLabel: (item: T) => string,
  isSelectable?: (item: T) => boolean,
): Column<T> {
  return {
    header: (
      <input
        type="checkbox"
        checked={allSelected}
        onChange={toggleAll}
        aria-label="全选"
        className="cursor-pointer"
      />
    ),
    width: "40px",
    cell: (item) => {
      if (isSelectable && !isSelectable(item)) {
        return <span className="text-ink-mute">—</span>;
      }
      return (
        <input
          type="checkbox"
          checked={selected.has(getId(item))}
          onChange={() => toggleRow(getId(item))}
          aria-label={`选择 ${ariaLabel(item)}`}
          className="cursor-pointer"
        />
      );
    },
  };
}

interface BatchDeleteButtonProps {
  /** 选中的 ID 集合 */
  selectedIds: Set<number>;
  /** 单条删除 API（返回 Promise） */
  deleteOne: (id: number) => Promise<unknown>;
  /** 删除完成后回调（通常是重新加载列表） */
  onDone: () => Promise<void> | void;
  /** 确认弹窗中实体名称，如「用户」「学生」 */
  entityLabel: string;
  /** 是否有写权限（无权限时隐藏按钮） */
  canWrite: boolean;
  /** 可选：额外提示文案 */
  hint?: string;
}

/**
 * 批量删除按钮 + 确认弹窗 + 逐条删除执行。
 * 与单条删除共用同一 API，逐条调用并汇总成功/失败数。
 */
export function BatchDeleteButton({
  selectedIds,
  deleteOne,
  onDone,
  entityLabel,
  canWrite,
  hint,
}: BatchDeleteButtonProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [running, setRunning] = React.useState(false);

  if (!canWrite) return null;

  const count = selectedIds.size;
  if (count === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Trash2 size={16} />
        批量删除
      </Button>
    );
  }

  const handleConfirm = async () => {
    setRunning(true);
    const ids = Array.from(selectedIds);
    let success = 0;
    let failed = 0;
    let firstError = "";
    for (const id of ids) {
      try {
        await deleteOne(id);
        success++;
      } catch (e) {
        failed++;
        if (!firstError) {
          firstError = e instanceof ApiError ? e.message : "删除失败";
        }
      }
    }
    if (failed === 0) {
      toast.success(`已批量删除 ${success} ${entityLabel}`);
    } else {
      toast.info(`成功 ${success} 条，失败 ${failed} 条`);
      if (firstError) toast.error(`部分失败：${firstError}`);
    }
    setRunning(false);
    setConfirmOpen(false);
    await onDone();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
        <Trash2 size={16} />
        批量删除（{count}）
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title={`批量删除${entityLabel}`}
        description={
          hint ??
          `确定删除选中的 ${count} ${entityLabel}吗？此操作不可撤销，部分关联数据可能导致部分删除失败。`
        }
        loading={running}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
