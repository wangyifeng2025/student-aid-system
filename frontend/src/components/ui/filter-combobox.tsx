"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/shadcn-combobox";

export type FilterOption = {
  value: string;
  label: string;
};

type FilterComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: FilterOption[];
  /** 未选择具体项时显示的文案，同时作为列表第一项。 */
  placeholder: string;
  disabled?: boolean;
  emptyText?: string;
  /** wide 用于院系、班级等较长名称，仍固定宽度，超出省略。 */
  size?: "compact" | "wide";
};

export function FilterCombobox({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  emptyText = "无匹配项",
  size = "compact",
}: FilterComboboxProps) {
  const items = React.useMemo(
    () => [{ value: "", label: placeholder }, ...options.filter((option) => option.value !== "")],
    [options, placeholder],
  );
  const selected = items.find((item) => item.value === value) ?? items[0];

  return (
    <div className={cn("shrink-0", size === "wide" ? "w-48" : "w-36")} title={selected.label}>
      <Combobox
        items={items}
        value={selected}
        onValueChange={(next) => onValueChange(next?.value ?? "")}
        isItemEqualToValue={(item, current) => item.value === current.value}
        disabled={disabled}
      >
        <ComboboxTrigger
          disabled={disabled}
          className="h-8 w-full min-w-0 justify-between gap-1 rounded-md border border-line bg-surface px-2 text-xs font-normal text-ink"
        >
          <span className="min-w-0 flex-1 truncate text-left">{selected.label}</span>
        </ComboboxTrigger>
        <ComboboxContent className="w-max min-w-56 max-w-md">
          <ComboboxInput placeholder="搜索" showTrigger={false} className="h-8" />
          <ComboboxEmpty>{emptyText}</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item.value || "__all"} value={item} className="whitespace-normal">
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
