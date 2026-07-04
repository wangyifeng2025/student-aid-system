"use client";

import * as React from "react";

/**
 * 管理表格行选择状态（批量操作用）。
 * 返回选中集合、单行切换、全选切换、是否全选、清空、选中数量。
 */
export function useRowSelection<T>(
  list: T[],
  getId: (item: T) => number,
): {
  selected: Set<number>;
  toggleRow: (id: number) => void;
  toggleAll: () => void;
  allSelected: boolean;
  clearSelection: () => void;
  selectedCount: number;
} {
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  const toggleRow = React.useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = list.length > 0 && list.every((item) => selected.has(getId(item)));

  const toggleAll = React.useCallback(() => {
    setSelected((prev) => {
      const allCurrentlySelected = list.length > 0 && list.every((item) => prev.has(getId(item)));
      if (allCurrentlySelected) {
        // 取消全选：移除当前列表中的所有 id
        const next = new Set(prev);
        for (const item of list) next.delete(getId(item));
        return next;
      }
      // 全选：将当前列表中的所有 id 加入
      const next = new Set(prev);
      for (const item of list) next.add(getId(item));
      return next;
    });
  }, [list, getId]);

  const clearSelection = React.useCallback(() => setSelected(new Set()), []);

  return {
    selected,
    toggleRow,
    toggleAll,
    allSelected,
    clearSelection,
    selectedCount: selected.size,
  };
}
