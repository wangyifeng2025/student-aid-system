"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  RELATION_OPTIONS,
  OCCUPATION_OPTIONS,
  HEALTH_OPTIONS,
} from "@/lib/recognition-options";
import type { FamilyMemberInput } from "@/types/recognition";

export function emptyMember(): FamilyMemberInput {
  return {
    name: "",
    age: 0,
    relation: "father",
    work_unit: "",
    occupation: "worker",
    annual_income: 0,
    health: "good",
    special_type: "",
  };
}

const inputCls =
  "w-full rounded-sm border border-line bg-transparent px-2 py-1 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-light";

interface Props {
  members: FamilyMemberInput[];
  onChange: (next: FamilyMemberInput[]) => void;
}

export function FamilyMembersEditor({ members, onChange }: Props) {
  const update = <K extends keyof FamilyMemberInput>(
    index: number,
    key: K,
    value: FamilyMemberInput[K],
  ) => {
    onChange(members.map((m, i) => (i === index ? { ...m, [key]: value } : m)));
  };

  const addRow = () => onChange([...members, emptyMember()]);
  const removeRow = (index: number) =>
    onChange(members.filter((_, i) => i !== index));

  return (
    <div>
      <div className="overflow-x-auto rounded-sm border border-line">
        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--color-bg-page)" }}>
              {[
                ["姓名", ""],
                ["年龄", "64px"],
                ["与学生关系", "120px"],
                ["工作/学习单位", ""],
                ["职业", "110px"],
                ["年收入(元)", "110px"],
                ["健康状况", "110px"],
                ["操作", "56px"],
              ].map(([h, w]) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-xs font-medium"
                  style={{
                    color: "var(--color-text-secondary)",
                    borderBottom: "1px solid var(--color-border)",
                    width: w || undefined,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-sm text-ink-mute"
                >
                  暂无家庭成员，点击下方「添加成员」录入（不含本人）。
                </td>
              </tr>
            ) : (
              members.map((m, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                  <td className="px-3 py-2">
                    <input
                      className={inputCls}
                      value={m.name}
                      onChange={(e) => update(i, "name", e.target.value)}
                      placeholder="姓名"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      value={m.age || ""}
                      onChange={(e) =>
                        update(i, "age", Number(e.target.value.replace(/\D/g, "")) || 0)
                      }
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className={`${inputCls} cursor-pointer`}
                      value={m.relation}
                      onChange={(e) => update(i, "relation", e.target.value)}
                    >
                      {RELATION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputCls}
                      value={m.work_unit}
                      onChange={(e) => update(i, "work_unit", e.target.value)}
                      placeholder="工作 / 学习单位"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className={`${inputCls} cursor-pointer`}
                      value={m.occupation}
                      onChange={(e) => update(i, "occupation", e.target.value)}
                    >
                      {OCCUPATION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      value={m.annual_income || ""}
                      onChange={(e) =>
                        update(
                          i,
                          "annual_income",
                          Number(e.target.value.replace(/[^\d.]/g, "")) || 0,
                        )
                      }
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className={`${inputCls} cursor-pointer`}
                      value={m.health}
                      onChange={(e) => update(i, "health", e.target.value)}
                    >
                      {HEALTH_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="inline-flex items-center justify-center"
                      style={{ color: "var(--state-error)" }}
                      aria-label="删除该成员"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-dashed border-line px-3.5 py-1.5 text-sm font-medium text-brand transition-colors hover:border-brand hover:bg-brand-subtle"
      >
        <Plus size={16} />
        添加成员
      </button>
    </div>
  );
}
