"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Undo2, RotateCcw, Download } from "lucide-react";
import { reviewApi, recognitionApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { StudentIdentity } from "@/components/recognition/student-identity";
import { StatusBadge } from "@/components/recognition/status-badge";
import { AttachmentsPanel } from "@/components/recognition/attachments-panel";
import { SignaturePreview } from "@/components/recognition/signature-preview";
import { ReviewLog } from "@/components/review/review-log";
import { ReviewActionDialog } from "@/components/review/review-action-dialog";
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
  canReview,
  canWithdrawReview,
  actingLevel,
} from "@/lib/recognition-options";
import type {
  Recognition,
  ReviewActionInput,
  ReviewActionType,
} from "@/types/recognition";

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

export default function ReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id);

  const [result, setResult] = React.useState<{
    forId: number;
    data: Recognition | null;
    error: string | null;
  } | null>(null);
  const [dialog, setDialog] = React.useState<ReviewActionType | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);
  const [withdrawing, setWithdrawing] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const next = await reviewApi.get(id);
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
    let cancelled = false;
    reviewApi
      .get(id)
      .then((next) => {
        if (!cancelled) setResult({ forId: id, data: next, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setResult({
            forId: id,
            data: null,
            error: e instanceof ApiError ? e.message : "加载失败",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loading = result?.forId !== id;
  const data = result?.forId === id ? result.data : null;
  const error = result?.forId === id ? result.error : null;

  const reviewable = !!data && canReview(role, data.status);
  const withdrawable = !!data && canWithdrawReview(role, userId, data.reviews);
  const level = data ? actingLevel(data.status) : 0;

  const handleExport = async () => {
    setExporting(true);
    try {
      await recognitionApi.exportDocx(id);
      toast.success("认定申请表已开始下载");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      await reviewApi.withdraw(id);
      toast.success("已撤回审核意见，可重新评审");
      setWithdrawOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "撤回失败");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleAction = async (input: ReviewActionInput) => {
    if (!dialog) return;
    setSubmitting(true);
    try {
      if (dialog === "pass") {
        await reviewApi.pass(id, input);
        toast.success("已通过，进入下一级评审");
      } else {
        await reviewApi.reject(id, input);
        toast.success("已退回");
      }
      setDialog(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "操作失败");
    } finally {
      setSubmitting(false);
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
        <Link href="/reviews" className="inline-flex items-center gap-1.5 text-sm text-link hover:underline">
          <ArrowLeft size={16} />
          返回困难认定审核
        </Link>
      </div>

      <StudentIdentity
        name={data.student_name}
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
            <AttachmentsPanel recognitionId={id} editable={false} />
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

            {reviewable ? (
              <Card title="评审操作">
                <div className="flex flex-col gap-3">
                  <Button onClick={() => setDialog("pass")} className="w-full">
                    <Check size={16} />
                    通过{level === 1 ? "（初定困难等级）" : ""}
                  </Button>
                  <Button variant="danger" onClick={() => setDialog("reject")} className="w-full">
                    <Undo2 size={16} />
                    退回
                  </Button>
                </div>
              </Card>
            ) : withdrawable ? (
              <Card title="评审操作">
                <p className="mb-3 text-sm text-ink-mute">
                  您已提交审核意见。上级尚未审核前可撤回并重新操作。
                </p>
                <Button variant="outline" onClick={() => setWithdrawOpen(true)} className="w-full">
                  <RotateCcw size={16} />
                  撤回审核意见
                </Button>
              </Card>
            ) : (
              <Card title="评审操作">
                <p className="text-sm text-ink-mute">
                  {data.status === "approved"
                    ? "该申请已认定通过。"
                    : data.status === "rejected"
                      ? "该申请已退回学生修改。"
                      : "当前不在您的评审环节，暂无可执行操作。"}
                </p>
              </Card>
            )}

            {data.status === "approved" && (
              <Card title="申请表">
                <Button variant="outline" onClick={handleExport} disabled={exporting} className="w-full">
                  <Download size={16} />
                  {exporting ? "下载中…" : "下载认定申请表（Word）"}
                </Button>
              </Card>
            )}

            <Card title="评审流转日志">
              {data.reject_reason && (data.status === "rejected" || data.current_level > 0) && (
                <div
                  className="mb-4 rounded-md px-3 py-2 text-xs"
                  style={{ background: "var(--state-error-bg)", color: "var(--state-error)" }}
                >
                  最近退回意见：{data.reject_reason}
                </div>
              )}
              <ReviewLog records={data.reviews} />
            </Card>
          </div>
        </div>
      </div>

      <ReviewActionDialog
        open={dialog !== null}
        action={dialog ?? "pass"}
        currentLevel={level}
        requireDifficulty={data.status === "pending_class"}
        defaultDifficulty={data.difficulty_level}
        loading={submitting}
        onConfirm={handleAction}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={withdrawOpen}
        title="撤回审核意见"
        description="确定撤回您最近一次审核意见吗？撤回后申请将回到您审核前的待审状态，可重新通过或退回。下级已审核后不可撤回。"
        confirmText="确认撤回"
        loading={withdrawing}
        onConfirm={handleWithdraw}
        onCancel={() => setWithdrawOpen(false)}
      />
    </div>
  );
}
