"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ExportScope = "all" | "filtered" | "selected";

interface ExportButtonsProps {
  /** 导出执行函数，传入范围 */
  onExport: (scope: ExportScope) => void;
  /** 是否正在导出 */
  exporting: boolean;
  /** 当前勾选了几个（0 时禁用「导出勾选」） */
  selectedCount: number;
  /** 当前是否设置了筛选条件（无筛选时隐藏「导出筛选」） */
  hasFilter: boolean;
  /** 按钮文案前缀，默认「导出」 */
  label?: string;
}

/**
 * 导出按钮组：拆分为独立按钮，避免新用户不知道有下拉。
 * - 导出全部：始终可用
 * - 导出筛选：仅当存在筛选条件时显示
 * - 导出勾选：勾选数为 0 时禁用，并显示当前勾选数
 */
export function ExportButtons({
  onExport,
  exporting,
  selectedCount,
  hasFilter,
  label = "导出",
}: ExportButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={exporting}
        onClick={() => onExport("all")}
      >
        <Download size={16} />
        {exporting ? "导出中…" : `${label}全部`}
      </Button>
      {hasFilter && (
        <Button
          variant="outline"
          size="sm"
          disabled={exporting}
          onClick={() => onExport("filtered")}
        >
          <Download size={16} />
          {label}筛选
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={exporting || selectedCount === 0}
        onClick={() => onExport("selected")}
      >
        <Download size={16} />
        {label}勾选
        {selectedCount > 0 && (
          <span className="ml-0.5 text-xs text-ink-mute">({selectedCount})</span>
        )}
      </Button>
    </div>
  );
}
