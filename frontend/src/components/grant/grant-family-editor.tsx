"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { RELATION_OPTIONS } from "@/lib/recognition-options";
import type { GrantFamilyMemberInput } from "@/types/grant";

export function emptyGrantMember(): GrantFamilyMemberInput {
  return { name: "", age: 0, relation: "", work_unit: "" };
}

interface Props {
  members: GrantFamilyMemberInput[];
  onChange: (members: GrantFamilyMemberInput[]) => void;
}

export function GrantFamilyEditor({ members, onChange }: Props) {
  const update = (idx: number, patch: Partial<GrantFamilyMemberInput>) => {
    const next = members.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    onChange(next);
  };

  const add = () => onChange([...members, emptyGrantMember()]);
  const remove = (idx: number) => onChange(members.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {members.map((m, idx) => (
        <div
          key={idx}
          className="grid grid-cols-2 gap-3 rounded-md border border-line p-3 md:grid-cols-4"
        >
          <Input placeholder="姓名" value={m.name} onChange={(e) => update(idx, { name: e.target.value })} />
          <Input
            type="number"
            placeholder="年龄"
            value={m.age || ""}
            onChange={(e) => update(idx, { age: Number(e.target.value) || 0 })}
          />
          <Select
            value={m.relation}
            onChange={(e) => update(idx, { relation: e.target.value })}
          >
            <option value="">关系</option>
            {RELATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              placeholder="工作或学习单位"
              value={m.work_unit}
              onChange={(e) => update(idx, { work_unit: e.target.value })}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(idx)} aria-label="删除">
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus size={16} />
        添加成员
      </Button>
    </div>
  );
}
