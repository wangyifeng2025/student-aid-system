"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  ArrowLeft,
  ArrowRight,
  Check,
  Users,
  CheckCircle2,
  AlertTriangle,
  Info,
  Send,
} from "lucide-react";
import { recognitionApi, studentApi, ApiError } from "@/lib/api";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  NATION_OPTIONS,
  INCOME_SOURCE_OPTIONS,
  HOUSEHOLD_OPTIONS,
  SPECIAL_GROUP_OPTIONS,
} from "@/lib/recognition-options";
import {
  FamilyMembersEditor,
  emptyMember,
} from "@/components/recognition/family-members-editor";
import { AttachmentsPanel } from "@/components/recognition/attachments-panel";
import { CommitmentSignatureBlock } from "@/components/recognition/commitment-signature-block";
import {
  loadSignatureDataUrls,
  syncSignatureAttachments,
} from "@/lib/signature-upload";
import type { Recognition, RecognitionInput } from "@/types/recognition";

// ===== 校验工具（与后端 pkg/validate 对齐）=====

const ID_CARD_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ID_CARD_CHECK = "10X98765432";

function isIdCard(s: string): boolean {
  const v = s.trim().toUpperCase();
  if (!/^\d{17}[\dX]$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += Number(v[i]) * ID_CARD_WEIGHTS[i];
  return v[17] === ID_CARD_CHECK[sum % 11];
}

function isPhone(s: string): boolean {
  return /^1[3-9]\d{9}$/.test(s.trim());
}

function computePerCapita(form: RecognitionInput): number {
  if (form.family_population <= 0) return 0;
  const total = form.family_members.reduce((sum, m) => sum + (m.annual_income || 0), 0);
  return Math.round((total / form.family_population) * 100) / 100;
}

function emptyForm(): RecognitionInput {
  return {
    year: new Date().getFullYear(),
    nation: "han",
    native_place: "",
    id_card: "",
    family_population: 1,
    phone: "",
    address: "",
    postal_code: "",
    guardian_phone: "",
    household_type: "rural",
    per_capita_annual_income: 0,
    income_source: "wage",
    special_types: [],
    natural_disaster: "",
    sudden_accident: "",
    weak_labor: "",
    unemployment: "",
    debt: "",
    other_info: "",
    commitment_agreed: false,
    family_members: [],
  };
}

function fromRecognition(r: Recognition): RecognitionInput {
  return {
    year: r.year,
    nation: r.nation,
    native_place: r.native_place,
    id_card: r.id_card,
    family_population: r.family_population,
    phone: r.phone,
    address: r.address,
    postal_code: r.postal_code,
    guardian_phone: r.guardian_phone,
    household_type: r.household_type,
    per_capita_annual_income: r.per_capita_annual_income,
    income_source: r.income_source,
    special_types: r.special_types ?? [],
    natural_disaster: r.natural_disaster,
    sudden_accident: r.sudden_accident,
    weak_labor: r.weak_labor,
    unemployment: r.unemployment,
    debt: r.debt,
    other_info: r.other_info,
    commitment_agreed: r.commitment_agreed,
    family_members: (r.family_members ?? []).map((m) => ({
      name: m.name,
      age: m.age,
      relation: m.relation,
      work_unit: m.work_unit,
      occupation: m.occupation,
      annual_income: m.annual_income,
      health: m.health,
      special_type: m.special_type,
    })),
  };
}

const STEPS = ["基本信息", "家庭情况", "经济影响", "提交确认"];

interface Props {
  mode: "create" | "edit";
  initial?: Recognition;
}

function SectionCard({
  title,
  extra,
  children,
}: {
  title?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mb-5"
      style={{
        backgroundColor: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: "24px 32px",
      }}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {extra}
        </div>
      )}
      {children}
    </div>
  );
}

export function RecognitionForm({ mode, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = React.useState<RecognitionInput>(
    initial ? fromRecognition(initial) : emptyForm(),
  );
  const [step, setStep] = React.useState(0);
  const [savedId, setSavedId] = React.useState<number | null>(
    mode === "edit" && initial ? initial.id : null,
  );
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [signatureDataUrl, setSignatureDataUrl] = React.useState("");
  const [signatureDirty, setSignatureDirty] = React.useState(false);

  // 编辑已有草稿时回填签字图。
  React.useEffect(() => {
    if (!savedId) return;
    let cancelled = false;
    (async () => {
      try {
        const imgs = await loadSignatureDataUrls(savedId);
        if (cancelled) return;
        setSignatureDataUrl(imgs.signature);
        setSignatureDirty(false);
      } catch {
        // 附件缺失时不阻断填报。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [savedId]);

  // 身份证号从学籍档案自动读取，学生不可手填。
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stu = await studentApi.me();
        if (cancelled) return;
        setForm((prev) => ({
          ...prev,
          id_card: stu.id_card,
          nation: prev.nation || stu.nation,
          phone: prev.phone || stu.phone,
        }));
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof ApiError ? e.message : "加载学籍信息失败");
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = <K extends keyof RecognitionInput>(key: K, value: RecognitionInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const perCapita = computePerCapita(form);
  const expectedMembers = Math.max(0, form.family_population - 1);
  const memberCountOk = form.family_members.length === expectedMembers;

  // 非阻断性提示（单亲 / 单薪）
  const warnings = React.useMemo(() => {
    const out: string[] = [];
    let parents = 0;
    let parentsWithIncome = 0;
    for (const m of form.family_members) {
      if (m.relation === "father" || m.relation === "mother") {
        parents++;
        if (m.annual_income > 0) parentsWithIncome++;
      }
    }
    if (parents === 1) out.push("检测到单亲家庭（父母仅一方在家庭成员中），请确认是否属实。");
    else if (parents >= 2 && parentsWithIncome <= 1)
      out.push("检测到单薪家庭（父母中仅一方有收入），请确认是否属实。");
    return out;
  }, [form.family_members]);

  const toggleSpecialType = (value: string) => {
    setForm((prev) => {
      const has = prev.special_types.includes(value);
      return {
        ...prev,
        special_types: has
          ? prev.special_types.filter((v) => v !== value)
          : [...prev.special_types, value],
      };
    });
  };

  // 草稿/提交前的轻量格式校验（仅校验已填字段）。
  function checkFormat(): string | null {
    if (!form.year || form.year < 2000) return "请填写有效的认定年度";
    if (form.id_card && !isIdCard(form.id_card)) return "身份证号格式不正确（需 18 位有效号码）";
    if (form.phone && !isPhone(form.phone)) return "手机号格式不正确";
    if (form.guardian_phone && !isPhone(form.guardian_phone)) return "家长手机号格式不正确";
    return null;
  }

  /** 第 0 步「基本信息」全部必填，未填完不可进入下一步。 */
  function checkStep0(): string | null {
    if (!form.year || form.year < 2000) return "请填写有效的认定年度";
    if (!form.nation.trim()) return "请选择民族";
    if (!form.native_place.trim()) return "请填写籍贯";
    if (!form.id_card || !isIdCard(form.id_card)) return "请填写有效的 18 位身份证号";
    if (!form.phone || !isPhone(form.phone)) return "请填写有效的手机号";
    if (!form.guardian_phone.trim()) return "请填写家长手机号";
    if (!isPhone(form.guardian_phone)) return "家长手机号格式不正确";
    if (form.family_population < 1) return "请填写家庭人口（至少为 1）";
    if (form.household_type !== "urban" && form.household_type !== "rural")
      return "请选择户口类型（城镇/农村）";
    if (!form.income_source.trim()) return "请选择主要收入来源";
    if (!form.postal_code.trim()) return "请填写邮政编码";
    if (!/^\d{6}$/.test(form.postal_code.trim())) return "邮政编码须为 6 位数字";
    if (!form.address.trim()) return "请填写详细通讯地址";
    return null;
  }

  /** 第 1 步「家庭成员」人数与姓名必填。 */
  function checkStep1(): string | null {
    if (form.family_members.length !== expectedMembers)
      return `家庭成员人数应为 ${expectedMembers} 人（家庭人口 ${form.family_population} 减去本人），当前 ${form.family_members.length} 人`;
    for (const m of form.family_members) {
      if (!m.name.trim()) return "请填写每位家庭成员的姓名";
      if (!m.relation.trim()) return "请选择每位家庭成员与学生的关系";
    }
    return null;
  }

  // 提交前的完整校验（镜像后端 validateForSubmit，并含分步必填项）。
  function checkForSubmit(): string | null {
    const step0Err = checkStep0();
    if (step0Err) return step0Err;
    const step1Err = checkStep1();
    if (step1Err) return step1Err;
    const hasDisabled = form.family_members.some((m) => m.health === "disabled");
    if (hasDisabled && !form.other_info.trim())
      return "家庭成员存在残疾，请在「其他情况说明」中补充说明";
    if (form.special_types.length === 0 && !form.other_info.trim())
      return "未勾选特殊群体类型时，请在「其他情况说明」中说明家庭经济困难原因";
    if (!form.commitment_agreed) return "请先勾选个人承诺";
    if (!signatureDataUrl) return "请完成学生本人（或监护人）签字";
    return null;
  }

  function handleNext() {
    if (step === 0) {
      const err = checkStep0();
      if (err) {
        toast.error(err);
        return;
      }
    } else if (step === 1) {
      const err = checkStep1();
      if (err) {
        toast.error(err);
        return;
      }
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function handleSelectStep(next: number) {
    // 仅允许回退到已完成步骤，禁止跳过未校验步骤。
    if (next <= step) setStep(next);
  }

  // 保存（create 或 update），返回申请 id。
  async function persist(): Promise<number | null> {
    const body: RecognitionInput = {
      ...form,
      per_capita_annual_income: perCapita,
    };
    try {
      if (savedId) {
        await recognitionApi.update(savedId, body);
        return savedId;
      }
      const created = await recognitionApi.create(body);
      setSavedId(created.id);
      return created.id;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "保存失败");
      return null;
    }
  }

  const handleSaveDraft = async () => {
    const fmtErr = checkFormat();
    if (fmtErr) {
      toast.error(fmtErr);
      return;
    }
    setSaving(true);
    const id = await persist();
    if (id && signatureDirty) {
      try {
        await syncSignatureAttachments(id, signatureDataUrl);
        setSignatureDirty(false);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "手写签字上传失败");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    if (id) toast.success("已保存草稿");
  };

  const handleSubmit = async () => {
    const err = checkForSubmit();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    const id = await persist();
    if (!id) {
      setSubmitting(false);
      return;
    }
    try {
      await syncSignatureAttachments(id, signatureDataUrl);
      setSignatureDirty(false);
      const res = await recognitionApi.submit(id);
      toast.success("申请已提交，进入班级评审");
      for (const w of res.warnings ?? []) toast.info(w);
      router.push(`/recognitions/${id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "提交失败");
      setSubmitting(false);
    }
  };

  const busy = saving || submitting;

  return (
    <div>
      {/* Stepper */}
      <div
        className="mb-5"
        style={{
          backgroundColor: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "24px 32px",
        }}
      >
        <div className="mx-auto flex items-center justify-between" style={{ maxWidth: 680 }}>
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && (
                <div
                  className="flex-1"
                  style={{
                    height: 2,
                    margin: "0 8px 20px",
                    backgroundColor:
                      i <= step ? "var(--color-primary)" : "var(--color-border)",
                  }}
                />
              )}
              <button
                type="button"
                onClick={() => handleSelectStep(i)}
                className="flex min-w-[80px] flex-col items-center"
              >
                <span
                  className="flex items-center justify-center text-xs font-semibold"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "var(--radius-full)",
                    backgroundColor:
                      i < step
                        ? "var(--state-success)"
                        : i === step
                          ? "var(--color-primary)"
                          : "var(--color-bg-page)",
                    color:
                      i <= step ? "var(--color-text-inverse)" : "var(--color-text-muted)",
                    border: i > step ? "2px solid var(--color-border)" : "none",
                  }}
                >
                  {i < step ? <Check size={16} /> : i + 1}
                </span>
                <span
                  className="mt-1.5 text-xs font-medium"
                  style={{
                    color:
                      i < step
                        ? "var(--state-success)"
                        : i === step
                          ? "var(--color-primary)"
                          : "var(--color-text-muted)",
                  }}
                >
                  {label}
                </span>
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step 0: 基本信息 */}
      {step === 0 && (
        <SectionCard title="基本信息">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
            <div>
              <Label>认定年度 *</Label>
              <Input
                inputMode="numeric"
                value={form.year || ""}
                onChange={(e) =>
                  set("year", Number(e.target.value.replace(/\D/g, "")) || 0)
                }
                placeholder="如：2026"
              />
            </div>
            <div>
              <Label>民族 *</Label>
              <Select className="h-10 w-full" value={form.nation} onChange={(e) => set("nation", e.target.value)}>
                {NATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>籍贯 *</Label>
              <Input
                value={form.native_place}
                onChange={(e) => set("native_place", e.target.value)}
                placeholder="如：贵州省贵阳市"
              />
            </div>
            <div>
              <Label>身份证号 *</Label>
              <Input
                value={form.id_card}
                readOnly
                disabled={profileLoading}
                placeholder={profileLoading ? "正在加载学籍信息…" : "18 位居民身份证"}
                className="bg-page text-ink-soft"
              />
              <p className="mt-1 text-xs text-ink-mute">
                身份证号从学籍档案自动读取，不可修改；如有误请联系管理员在学生管理中更正。
              </p>
            </div>
            <div>
              <Label>手机号 *</Label>
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="本人手机号"
              />
            </div>
            <div>
              <Label>家长手机号 *</Label>
              <Input
                value={form.guardian_phone}
                onChange={(e) => set("guardian_phone", e.target.value)}
                placeholder="家长 / 监护人手机号"
              />
            </div>
            <div>
              <Label>家庭人口 *</Label>
              <Input
                inputMode="numeric"
                value={form.family_population || ""}
                onChange={(e) =>
                  set("family_population", Number(e.target.value.replace(/\D/g, "")) || 0)
                }
                placeholder="含本人"
              />
            </div>
            <div>
              <Label>户口类型 *</Label>
              <Select
                className="h-10 w-full"
                value={form.household_type}
                onChange={(e) => set("household_type", e.target.value)}
              >
                {HOUSEHOLD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>主要收入来源 *</Label>
              <Select
                className="h-10 w-full"
                value={form.income_source}
                onChange={(e) => set("income_source", e.target.value)}
              >
                {INCOME_SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>邮政编码 *</Label>
              <Input
                value={form.postal_code}
                onChange={(e) => set("postal_code", e.target.value)}
                placeholder="如：550001"
              />
            </div>
            <div className="md:col-span-2">
              <Label>详细通讯地址 *</Label>
              <Input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="省 / 市 / 区县 / 街道门牌"
              />
            </div>
          </div>
        </SectionCard>
      )}

      {/* Step 1: 家庭情况 */}
      {step === 1 && (
        <SectionCard
          title="家庭成员信息"
          extra={
            memberCountOk ? (
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--state-success)" }}>
                <CheckCircle2 size={14} />
                家庭人口数一致
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--state-warning)" }}>
                <AlertTriangle size={14} />
                与家庭人口数不一致
              </span>
            )
          }
        >
          <p className="mb-3 text-xs text-ink-soft">
            请填写家庭成员信息（不含本人），人数应等于「家庭人口 − 1」。
          </p>
          <div
            className="mb-4 inline-flex items-center gap-1.5"
            style={{
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-primary-subtle)",
              border: "1px solid var(--color-primary-light)",
            }}
          >
            <Users size={14} style={{ color: "var(--color-primary)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--color-primary)" }}>
              家庭人口：{form.family_population} 人，应填 {expectedMembers} 人，已填{" "}
              {form.family_members.length} 人
            </span>
          </div>

          <FamilyMembersEditor
            members={form.family_members}
            onChange={(next) => set("family_members", next)}
          />

          <div style={{ borderTop: "1px solid var(--color-border)", margin: "24px 0" }} />

          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">特殊群体勾选</h3>
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--state-info)" }}>
              <Info size={14} />
              已选 {form.special_types.length} 项
            </span>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
            {SPECIAL_GROUP_OPTIONS.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded"
                  style={{ accentColor: "var(--color-primary)" }}
                  checked={form.special_types.includes(o.value)}
                  onChange={() => toggleSpecialType(o.value)}
                />
                {o.label}
              </label>
            ))}
          </div>

          <Label>其他情况说明</Label>
          <textarea
            className="w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-light"
            rows={3}
            value={form.other_info}
            onChange={(e) => set("other_info", e.target.value)}
            placeholder="如未勾选特殊群体，或家庭成员有残疾/重病等，请在此说明家庭经济困难原因"
          />
        </SectionCard>
      )}

      {/* Step 2: 经济影响 */}
      {step === 2 && (
        <SectionCard title="影响家庭经济状况">
          <div
            className="mb-5 flex items-center gap-3 rounded-md px-4 py-3"
            style={{ backgroundColor: "var(--color-bg-page)" }}
          >
            <span className="text-sm text-ink-soft">家庭人均年收入（自动计算）</span>
            <span className="text-lg font-semibold tabular-nums" style={{ color: "var(--color-primary)" }}>
              ¥{perCapita.toLocaleString()}
            </span>
            <span className="text-xs text-ink-mute">
              = 家庭成员年收入合计 ÷ 家庭人口（{form.family_population}）
            </span>
          </div>

          {warnings.length > 0 && (
            <div
              className="mb-5 rounded-md px-3 py-2 text-xs"
              style={{ background: "var(--state-warning-bg)", color: "var(--state-warning)" }}
            >
              {warnings.map((w) => (
                <div key={w} className="flex items-start gap-1.5">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
            {([
              ["natural_disaster", "自然灾害影响"],
              ["sudden_accident", "突发意外事件"],
              ["weak_labor", "家庭劳动力情况"],
              ["unemployment", "失业 / 待业情况"],
              ["debt", "家庭负债情况"],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                <textarea
                  className="w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-light"
                  rows={2}
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder="无则可留空或填「无」"
                />
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Step 3: 提交确认 */}
      {step === 3 && (
        <>
          <SectionCard title="个人承诺与签字">
            <p className="mb-3 text-xs text-ink-mute">
              请阅读印刷承诺正文，完成本人或监护人签字，并勾选同意。
            </p>
            <CommitmentSignatureBlock
              signatureDataUrl={signatureDataUrl}
              onSignatureChange={(v) => {
                setSignatureDataUrl(v);
                setSignatureDirty(true);
              }}
              disabled={busy}
            />
            <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded"
                style={{ accentColor: "var(--color-primary)" }}
                checked={form.commitment_agreed}
                onChange={(e) => set("commitment_agreed", e.target.checked)}
              />
              <span>我已阅读并同意上述个人承诺内容。</span>
            </label>
          </SectionCard>

          <SectionCard title="提交确认">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm md:grid-cols-2">
              <SummaryItem label="认定年度" value={String(form.year || "—")} />
              <SummaryItem
                label="家庭人口 / 已填成员"
                value={`${form.family_population} 人 / ${form.family_members.length} 人`}
              />
              <SummaryItem label="人均年收入" value={`¥${perCapita.toLocaleString()}`} />
              <SummaryItem
                label="特殊群体"
                value={form.special_types.length ? `${form.special_types.length} 项` : "未勾选"}
              />
            </dl>
          </SectionCard>

          <SectionCard title="附件材料">
            {savedId ? (
              <AttachmentsPanel recognitionId={savedId} editable />
            ) : (
              <p className="text-sm text-ink-mute">请先「保存草稿」，保存后即可上传证明材料。</p>
            )}
          </SectionCard>
        </>
      )}

      {/* Bottom action bar */}
      <div className="flex items-center justify-between pt-1 pb-2">
        <Button variant="outline" onClick={handleSaveDraft} disabled={busy}>
          <Save size={16} />
          {saving ? "保存中…" : "保存草稿"}
        </Button>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || busy}
          >
            <ArrowLeft size={16} />
            上一步
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={busy}>
              下一步
              <ArrowRight size={16} />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={busy}>
              <Send size={16} />
              {submitting ? "提交中…" : "提交评审"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md px-3 py-2" style={{ backgroundColor: "var(--color-bg-page)" }}>
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium text-ink tabular-nums">{value}</span>
    </div>
  );
}
