"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save, Send, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { grantApi, ApiError } from "@/lib/api";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { HOUSEHOLD_OPTIONS, INCOME_SOURCE_OPTIONS, nationLabel } from "@/lib/recognition-options";
import { GrantFamilyEditor } from "@/components/grant/grant-family-editor";
import type { Grant, GrantInput } from "@/types/grant";

function emptyForm(): GrantInput {
  return {
    year: new Date().getFullYear(),
    phone: "",
    household_type: "rural",
    family_population: 1,
    monthly_income: 0,
    per_capita_monthly_income: 0,
    income_source: "wage",
    address: "",
    postal_code: "",
    reason: "",
    family_members: [],
  };
}

function fromGrant(g: Grant): GrantInput {
  return {
    year: g.year,
    phone: g.phone,
    household_type: g.household_type,
    family_population: g.family_population,
    monthly_income: g.monthly_income,
    per_capita_monthly_income: g.per_capita_monthly_income,
    income_source: g.income_source,
    address: g.address,
    postal_code: g.postal_code,
    reason: g.reason,
    family_members: g.family_members.map(({ name, age, relation, work_unit }) => ({
      name,
      age,
      relation,
      work_unit,
    })),
  };
}

interface Props {
  mode: "create" | "edit";
  grantId?: number;
  recognitionId?: number;
  initial?: Grant;
}

export function GrantForm({ mode, grantId, recognitionId, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = React.useState<GrantInput>(initial ? fromGrant(initial) : emptyForm());
  const [preview, setPreview] = React.useState<Grant | null>(initial ?? null);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [creating, setCreating] = React.useState(mode === "create");

  React.useEffect(() => {
    if (mode !== "create" || !recognitionId || initial) return;
    let cancelled = false;
    (async () => {
      setCreating(true);
      try {
        const g = await grantApi.create({ recognition_id: recognitionId, grant_type: "national_aid" });
        if (!cancelled) {
          setPreview(g);
          setForm(fromGrant(g));
          router.replace(`/grants/${g.id}/edit`);
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof ApiError ? e.message : "创建失败");
      } finally {
        if (!cancelled) setCreating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, recognitionId, initial, router]);

  const patch = (p: Partial<GrantInput>) => setForm((f) => ({ ...f, ...p }));

  const save = async () => {
    if (!grantId && !preview?.id) return;
    const id = grantId ?? preview!.id;
    setSaving(true);
    try {
      const updated = await grantApi.update(id, form);
      setPreview(updated);
      toast.success("已保存草稿");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!grantId && !preview?.id) return;
    const id = grantId ?? preview!.id;
    setSubmitting(true);
    try {
      await grantApi.update(id, form);
      await grantApi.submit(id);
      toast.success("已提交，进入班级评审");
      router.push(`/grants/${id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (creating) {
    return <p className="py-10 text-center text-sm text-ink-soft">正在从认定表预填数据…</p>;
  }

  const readonly = preview;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/grants" className="inline-flex items-center gap-1.5 text-sm text-link hover:underline">
          <ArrowLeft size={16} />
          返回列表
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={save} disabled={saving}>
            <Save size={16} />
            {saving ? "保存中…" : "保存草稿"}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            <Send size={16} />
            {submitting ? "提交中…" : "提交申请"}
          </Button>
        </div>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-ink">贵州省高等学校国家助学金申请表</h2>

      <section className="mb-6 rounded-md border border-line bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">本人情况（学籍信息，只读）</h3>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
          <div><span className="text-ink-soft">姓名</span><div>{readonly?.student_name || "—"}</div></div>
          <div><span className="text-ink-soft">性别</span><div>{readonly?.gender === "male" ? "男" : readonly?.gender === "female" ? "女" : readonly?.gender || "—"}</div></div>
          <div><span className="text-ink-soft">出生年月</span><div>{readonly?.birth || "—"}</div></div>
          <div><span className="text-ink-soft">民族</span><div>{nationLabel(readonly?.nation || "")}</div></div>
          <div><span className="text-ink-soft">政治面貌</span><div>{readonly?.political_status || "—"}</div></div>
          <div><span className="text-ink-soft">入学时间</span><div>{readonly?.enroll_time || "—"}</div></div>
          <div><span className="text-ink-soft">学号</span><div>{readonly?.student_no || "—"}</div></div>
          <div><span className="text-ink-soft">所在年级</span><div>{readonly?.grade_name || "—"}</div></div>
          <div><span className="text-ink-soft">身份证号</span><div>{readonly?.id_card || "—"}</div></div>
          <div className="col-span-full"><span className="text-ink-soft">院系专业班级</span><div>{readonly?.school_unit || "—"}</div></div>
        </div>
      </section>

      <section className="mb-6 rounded-md border border-line bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">联系与家庭经济情况</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>联系电话</Label>
            <Input value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
          </div>
          <div>
            <Label>家庭户口</Label>
            <Select value={form.household_type} onChange={(e) => patch({ household_type: e.target.value })}>
              {HOUSEHOLD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>家庭总人数</Label>
            <Input type="number" value={form.family_population || ""} onChange={(e) => patch({ family_population: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <Label>家庭月总收入（元）</Label>
            <Input type="number" value={form.monthly_income || ""} onChange={(e) => patch({ monthly_income: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <Label>人均月收入（元）</Label>
            <Input type="number" value={form.per_capita_monthly_income || ""} onChange={(e) => patch({ per_capita_monthly_income: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <Label>收入来源</Label>
            <Select value={form.income_source} onChange={(e) => patch({ income_source: e.target.value })}>
              {INCOME_SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>家庭住址</Label>
            <Input value={form.address} onChange={(e) => patch({ address: e.target.value })} />
          </div>
          <div>
            <Label>邮政编码</Label>
            <Input value={form.postal_code} onChange={(e) => patch({ postal_code: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-md border border-line bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">家庭成员情况</h3>
        <GrantFamilyEditor members={form.family_members} onChange={(family_members) => patch({ family_members })} />
      </section>

      <section className="mb-6 rounded-md border border-line bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">申请理由（建议 150 字左右）</h3>
        <textarea
          className="min-h-[120px] w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
          value={form.reason}
          onChange={(e) => patch({ reason: e.target.value })}
          placeholder="请简要说明家庭经济困难情况及申请助学金的理由…"
        />
        <p className="mt-1 text-xs text-ink-mute">{form.reason.length} 字</p>
      </section>
    </div>
  );
}
