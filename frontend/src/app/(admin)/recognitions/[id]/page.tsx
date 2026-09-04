"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, Download, Send, Undo2, Wallet } from "lucide-react";
import { recognitionApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StudentIdentity } from "@/components/recognition/student-identity";
import { StatusBadge } from "@/components/recognition/status-badge";
import { ProgressTimeline } from "@/components/recognition/progress-timeline";
import { ReviewLog } from "@/components/review/review-log";
import { AttachmentsPanel } from "@/components/recognition/attachments-panel";
import { SignaturePreview } from "@/components/recognition/signature-preview";
import {
  nationLabel,
  householdLabel,
  incomeSourceLabel,
  relationLabel,
  occupationLabel,
  healthLabel,
  specialGroupLabel,
  difficultyLabel,
  difficultyTone,
  levelName,
  canDeleteRecognition,
  canWithdrawRecognition,
} from "@/lib/recognition-options";
import type { Recognition } from "@/types/recognition";

function Card({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div
      className="mb-4"
      style={{
        backgroundColor: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: "20px",
      }}
    >
      <div
        className="mb-4 flex items-center justify-between pb-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {extra}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <div className="mb-0.5 text-xs text-ink-soft">{label}</div>
      <div className="text-sm text-ink tabular-nums">{value || "—"}</div>
    </div>
  );
}

export default function RecognitionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const isStudent = role === "student";

  const [result, setResult] = React.useState<{
    forId: number;
    data: Recognition | null;
    error: string | null;
  } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmSubmit, setConfirmSubmit] = React.useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [withdrawing, setWithdrawing] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const next = await recognitionApi.get(id);
      setResult({ forId: id, data: next, error: null });
    } catch (e) {
      setResult({
        forId: id,
        data: null,
        error: e instanceof ApiError ? e.message : "加载失败",
      });
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const loading = result?.forId !== id;
  const data = result?.forId === id ? result.data : null;
  const error = result?.forId === id ? result.error : null;

  const editable = !!data && isStudent && (data.status === "draft" || data.status === "rejected");
  const deletable = !!data && isStudent && canDeleteRecognition(data.status, data.reviews);
  const withdrawable = !!data && isStudent && canWithdrawRecognition(data.status, data.reviews);
  const canManage = editable;

  const handleSubmit = async () => {
    setConfirmSubmit(false);
    setSubmitting(true);
    try {
      const res = await recognitionApi.submit(id);
      toast.success("申请已提交，进入班级评审");
      for (const w of res.warnings ?? []) toast.info(w);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "提交失败，请检查填报是否完整");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await recognitionApi.remove(id);
      toast.success("已删除申请");
      router.push("/recognitions");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleWithdraw = async () => {
    setConfirmWithdraw(false);
    setWithdrawing(true);
    try {
      await recognitionApi.withdraw(id);
      toast.success("已撤回申请，可继续编辑后重新提交");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "撤回失败");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleExport = async () => {
    try {
      await recognitionApi.exportDocx(id);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "导出失败");
    }
  };

  if (loading) return <LoadingState />;
  if (error) {
    return (
      <ErrorState
        label={error}
        onRetry={() => {
          setResult(null);
          void load();
        }}
      />
    );
  }
  if (!data) return null;

  return (
    <div>
      <div className="mb-5">
        <Link href="/recognitions" className="inline-flex items-center gap-1.5 text-sm text-link hover:underline">
          <ArrowLeft size={16} />
          返回列表
        </Link>
      </div>

      <StudentIdentity
        name={data.student_name || "本人"}
        studentNo={data.student_no}
        deptName={data.dept_name}
        className={data.class_name}
        extra={
          <>
            <span className="text-sm text-ink-mute">· {data.year} 年度</span>
            <StatusBadge status={data.status} />
          </>
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left */}
        <div className="min-w-0 flex-1">
          <Card title="基本信息">
            <div className="grid grid-cols-2 gap-x-6 md:grid-cols-3">
              <Field label="姓名" value={data.student_name} />
              <Field label="学号" value={data.student_no} />
              <Field label="教学系" value={data.dept_name} />
              <Field label="班级" value={data.class_name} />
              <Field label="认定年度" value={data.year} />
              <Field label="民族" value={nationLabel(data.nation)} />
              <Field label="籍贯" value={data.native_place} />
              <Field label="身份证号" value={data.id_card} />
              <Field label="手机号" value={data.phone} />
              <Field label="家长手机号" value={data.guardian_phone} />
              <Field label="户口类型" value={householdLabel(data.household_type)} />
              <Field label="主要收入来源" value={incomeSourceLabel(data.income_source)} />
              <Field label="家庭人口" value={`${data.family_population} 人`} />
              <Field label="邮政编码" value={data.postal_code} />
              <Field label="详细通讯地址" value={data.address} />
            </div>
          </Card>

          <Card title="家庭成员">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--color-bg-page)" }}>
                    {["序号", "姓名", "关系", "年龄", "工作/学习单位", "职业", "年收入", "健康状况"].map((h) => (
                      <th
                        key={h}
                        className="px-2.5 py-2 text-left text-xs font-medium"
                        style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.family_members.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-2.5 py-6 text-center text-ink-mute">
                        未填写家庭成员
                      </td>
                    </tr>
                  ) : (
                    data.family_members.map((m, i) => (
                      <tr key={m.id || i} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                        <td className="px-2.5 py-2">{i + 1}</td>
                        <td className="px-2.5 py-2 text-ink">{m.name || "—"}</td>
                        <td className="px-2.5 py-2">{relationLabel(m.relation)}</td>
                        <td className="px-2.5 py-2 tabular-nums">{m.age || "—"}</td>
                        <td className="px-2.5 py-2">{m.work_unit || "—"}</td>
                        <td className="px-2.5 py-2">{occupationLabel(m.occupation)}</td>
                        <td className="px-2.5 py-2 tabular-nums">¥{(m.annual_income || 0).toLocaleString()}</td>
                        <td className="px-2.5 py-2">{healthLabel(m.health)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="影响家庭经济状况">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-xs text-ink-soft">家庭人均年收入</span>
              <span className="text-lg font-semibold tabular-nums" style={{ color: "var(--color-primary)" }}>
                ¥{(data.per_capita_annual_income || 0).toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
              <Field label="自然灾害影响" value={data.natural_disaster} />
              <Field label="突发意外事件" value={data.sudden_accident} />
              <Field label="家庭劳动力情况" value={data.weak_labor} />
              <Field label="失业 / 待业情况" value={data.unemployment} />
              <Field label="家庭负债情况" value={data.debt} />
            </div>
            {data.other_info && (
              <div className="mt-3">
                <Field label="其他情况说明" value={data.other_info} />
              </div>
            )}
          </Card>

          <Card title="特殊群体">
            {data.special_types.length === 0 ? (
              <p className="text-sm text-ink-mute">未勾选任何特殊群体类型。</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.special_types.map((t) => (
                  <Badge key={t} tone="brand">
                    {specialGroupLabel(t)}
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          <Card title="个人承诺与签字">
            <SignaturePreview recognitionId={id} />
          </Card>

          <Card title="低收入证明材料">
            <AttachmentsPanel recognitionId={id} editable={canManage} />
          </Card>
        </div>

        {/* Right (sticky) */}
        <div className="w-full shrink-0 lg:w-85">
          <div className="lg:sticky lg:top-6">
            <Card title="评审信息">
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-soft">当前状态</span>
                  <StatusBadge status={data.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-soft">当前级别</span>
                  <span className="text-ink">{levelName(data.current_level)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-soft">困难等级</span>
                  {data.difficulty_level ? (
                    <Badge tone={difficultyTone(data.difficulty_level)}>
                      {difficultyLabel(data.difficulty_level)}
                    </Badge>
                  ) : (
                    <span className="text-ink-mute">未评定</span>
                  )}
                </div>
              </div>
            </Card>

            {(canManage || deletable || withdrawable || data.status === "approved") && (
              <Card title="操作">
                <div className="flex flex-col gap-3">
                  {canManage && (
                    <>
                      <Button onClick={() => setConfirmSubmit(true)} disabled={submitting} className="w-full">
                        <Send size={16} />
                        {submitting ? "提交中…" : "提交评审"}
                      </Button>
                      <Link href={`/recognitions/${id}/edit`} className="w-full">
                        <Button variant="outline" className="w-full">
                          <Pencil size={16} />
                          编辑申请
                        </Button>
                      </Link>
                    </>
                  )}
                  {deletable && (
                    <Button variant="danger" onClick={() => setConfirmDelete(true)} className="w-full">
                      <Trash2 size={16} />
                      删除申请
                    </Button>
                  )}
                  {withdrawable && (
                    <Button
                      variant="outline"
                      onClick={() => setConfirmWithdraw(true)}
                      disabled={withdrawing}
                      className="w-full"
                    >
                      <Undo2 size={16} />
                      {withdrawing ? "撤回中…" : "撤回申请"}
                    </Button>
                  )}
                  {data.status === "approved" && isStudent && (
                    <>
                      <div
                        className="rounded-md px-3 py-2 text-xs"
                        style={{
                          background: "var(--state-success-bg)",
                          color: "var(--state-success)",
                        }}
                      >
                        困难等级认定已通过，您可发起国家助学金申请。
                      </div>
                      <Link href={`/grants/new?recognition_id=${data.id}`} className="block">
                        <Button className="w-full">
                          <Wallet size={16} />
                          申请国家助学金
                        </Button>
                      </Link>
                    </>
                  )}
                  {data.status === "approved" && (
                    <Button variant="outline" onClick={handleExport} className="w-full">
                      <Download size={16} />
                      下载认定申请表（Word）
                    </Button>
                  )}
                </div>
              </Card>
            )}

            <Card title="审核进度">
              <ProgressTimeline status={data.status} rejectReason={data.reject_reason} />
            </Card>

            {data.reviews && data.reviews.length > 0 && (
              <Card title="评审流转日志">
                <ReviewLog records={data.reviews} />
              </Card>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        title="提交认定申请"
        description="提交后将进入班级评审。在班主任审核前可撤回或删除；班级审核后将不可撤回或删除。确定提交吗？"
        confirmText="确认提交"
        loading={submitting}
        onConfirm={handleSubmit}
        onCancel={() => setConfirmSubmit(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="删除认定申请"
        description={`确定删除 ${data.year} 年度的认定申请吗？草稿、被退回，或已提交但班级尚未审核的申请可删除，该操作不可撤销。`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        open={confirmWithdraw}
        title="撤回认定申请"
        description={`确定撤回 ${data.year} 年度的认定申请吗？撤回后将恢复为草稿，可继续编辑后重新提交。`}
        confirmText="确认撤回"
        loading={withdrawing}
        onConfirm={handleWithdraw}
        onCancel={() => setConfirmWithdraw(false)}
      />
    </div>
  );
}
