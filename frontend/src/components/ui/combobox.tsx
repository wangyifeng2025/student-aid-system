"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** 列表次要信息，如电话 */
  description?: string;
  /** 额外参与搜索的文本（姓名、教工号等） */
  keywords?: string;
}

interface ComboboxBaseProps {
  id?: string;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

interface ComboboxSingleProps extends ComboboxBaseProps {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
}

interface ComboboxMultipleProps extends ComboboxBaseProps {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
}

export type ComboboxProps = ComboboxSingleProps | ComboboxMultipleProps;

function optionSearchText(option: ComboboxOption): string {
  return `${option.label} ${option.description ?? ""} ${option.keywords ?? ""}`.toLowerCase();
}

function sameRect(a: DOMRect | null, b: DOMRect): boolean {
  return !!a && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

export function Combobox(props: ComboboxProps) {
  const {
    id,
    options,
    placeholder = "输入关键词搜索…",
    emptyText = "无匹配项",
    disabled,
    className,
  } = props;
  const multiple = props.multiple === true;
  const selectedValues = React.useMemo(
    () => (multiple ? props.value : props.value ? [props.value] : []),
    [multiple, props.value],
  );

  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  const selected = !multiple ? options.find((o) => o.value === props.value) : undefined;
  const selectedOptions = options.filter((o) => selectedValues.includes(o.value));

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => optionSearchText(o).includes(q));
  }, [options, query]);

  const updateRect = React.useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const next = el.getBoundingClientRect();
    setRect((prev) => (sameRect(prev, next) ? prev : next));
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    updateRect();
    const onReposition = () => updateRect();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onReposition) : null;
    if (rootRef.current && ro) {
      ro.observe(rootRef.current);
    }
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      ro?.disconnect();
    };
  }, [open, updateRect]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  React.useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  const emit = (next: string[]) => {
    if (props.multiple) {
      props.onChange(next);
    } else {
      props.onChange(next[0] ?? "");
    }
  };

  const pick = (next: string) => {
    if (props.multiple) {
      const has = selectedValues.includes(next);
      emit(has ? selectedValues.filter((v) => v !== next) : [...selectedValues, next]);
      setQuery("");
      inputRef.current?.focus();
      return;
    }
    emit([next]);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const remove = (item: string) => {
    emit(selectedValues.filter((v) => v !== item));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && props.multiple && query === "" && selectedValues.length > 0) {
      e.preventDefault();
      emit(selectedValues.slice(0, -1));
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[highlight];
      if (open && item) pick(item.value);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setQuery("");
    }
  };

  const list =
    open && rect && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={listRef}
            role="listbox"
            aria-multiselectable={multiple || undefined}
            id={id ? `${id}-listbox` : undefined}
            className="z-60 max-h-56 overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-(--shadow-elevated)"
            style={{
              position: "fixed",
              top: rect.bottom + 4,
              left: rect.left,
              width: rect.width,
            }}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-mute">{emptyText}</li>
            ) : (
              filtered.map((option, index) => {
                const active = selectedValues.includes(option.value);
                const focused = index === highlight;
                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={active}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm",
                      focused ? "bg-brand-subtle text-ink" : "text-ink-soft",
                    )}
                    onMouseEnter={() => setHighlight(index)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(option.value);
                    }}
                  >
                    <Check
                      size={14}
                      className={cn("shrink-0", active ? "text-brand opacity-100" : "opacity-0")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ink">{option.label}</span>
                      {option.description ? (
                        <span className="block truncate font-mono text-xs text-ink-mute">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )
      : null;

  const inputClass = cn(
    "min-w-[8rem] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-mute",
    "disabled:cursor-not-allowed disabled:opacity-60",
    multiple ? "h-7 px-1" : "h-9 w-full rounded-sm border border-line bg-surface pr-8 pl-2.5 transition-colors duration-150 focus:border-brand focus:ring-2 focus:ring-brand-light",
  );

  const input = (
    <input
      ref={inputRef}
      id={id}
      role="combobox"
      aria-expanded={open}
      aria-controls={id ? `${id}-listbox` : undefined}
      aria-autocomplete="list"
      disabled={disabled}
      autoComplete="off"
      placeholder={multiple && selectedOptions.length > 0 ? "继续搜索…" : placeholder}
      value={open || multiple ? query : (selected?.label ?? "")}
      onChange={(e) => {
        setQuery(e.target.value);
        if (!open) setOpen(true);
      }}
      onFocus={() => {
        if (!multiple) setQuery("");
        setOpen(true);
      }}
      onKeyDown={onKeyDown}
      className={inputClass}
    />
  );

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {multiple ? (
        <div
          className={cn(
            "flex min-h-9 w-full cursor-text flex-wrap items-center gap-1 rounded-sm border border-line bg-surface py-1 pr-8 pl-1.5",
            "focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-light",
            disabled && "cursor-not-allowed opacity-60",
          )}
          onClick={() => {
            if (disabled) return;
            inputRef.current?.focus();
            setOpen(true);
          }}
        >
          {selectedOptions.map((option) => (
            <span
              key={option.value}
              className="inline-flex max-w-full items-center gap-1 rounded-sm bg-brand-subtle px-1.5 py-0.5 text-xs text-brand"
            >
              <span className="truncate">{option.label}</span>
              <button
                type="button"
                aria-label={`移除 ${option.label}`}
                className="inline-flex shrink-0 rounded-sm p-0.5 hover:bg-brand-light"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(option.value);
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {input}
          <ChevronsUpDown
            size={14}
            className="pointer-events-none absolute top-2.5 right-2.5 text-ink-mute"
          />
        </div>
      ) : (
        <div className="relative">
          {input}
          <ChevronsUpDown
            size={14}
            className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-mute"
          />
        </div>
      )}
      {list}
    </div>
  );
}
