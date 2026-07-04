"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Undo2, RotateCcw } from "lucide-react";
import { grantReviewApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { GrantStatusBadge } from "@/components/grant/grant-status-badge";
import { ReviewLog } from "@/components/review/review-log";
import { ReviewActionDialog } from "@/components/review/review-action-dialog";
import {
  canReviewGrant,
  grantTypeLabel,
} from "@/lib/grant-options";
import {
  canWithdrawReview,
  householdLabel,
  incomeSourceLabel,
  levelName,
  nationLabel,
  relationLabel,
  actingLevel,
} from "@/lib/recognition-options";
import type { Grant } from "@/types/grant";
import type { ReviewActionInput, ReviewActionType } from "@/types/recognition";

export default function GrantReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id);

  const [data, setData] = React.useState<Grant | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<ReviewActionType | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);
  const [withdrawing, setWithdrawing] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await grantReviewApi.get(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const reviewable = !!data && canReviewGrant(role, data.status);
  const withdrawable = !!data && canWithdrawReview(role, userId, data.reviews);
  const level = data ? actingLevel(data.status as never) : 0;

  const handleAction = async (input: ReviewActionInput) => {
    if (!dialog) return;
    setSubmitting(true);
    try {
      if (dialog === "pass") {
        await grantReviewApi.pass(id, input);
        toast.success("已通过，进入下一级评审");
      } else {
        await grantReviewApi.reject(id, input);
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

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      await grantReviewApi.withdraw(id);
      toast.success("已撤回审核意见");
      setWithdrawOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "撤回失败");
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState label={error} onRetry={load} />;
  if (!data) return null;

  return (
    <div>
      <Link href="/grant-reviews" className="mb-4 inline-flex items-center gap-1.5 text-sm text-link hover:underline">
        <ArrowLeft size={16} /> 返回助学金待办
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">{data.student_name} — {grantTypeLabel(data.grant_type)}</h2>
        <GrantStatusBadge status={data.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="rounded-md border border-line bg-surface p-5 text-sm">
            <h3 className="mb-3 font-semibold">本人情况</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <div>学号：{data.student_no}</div>
              <div>民族：{nationLabel(data.nation)}</div>
              <div>年级：{data.grade_name}</div>
              <div className="col-span-full">院系专业班级：{data.school_unit}</div>
              <div>电话：{data.phone}</div>
            </div>
          </section>
          <section className="rounded-md border border-line bg-surface p-5 text-sm">
            <h3 className="mb-3 font-semibold">家庭经济</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>户口：{householdLabel(data.household_type)}</div>
              <div>家庭人口：{data.family_population}</div>
              <div>月总收入：¥{data.monthly_income.toLocaleString()}</div>
              <div>人均月收入：¥{data.per_capita_monthly_income.toLocaleString()}</div>
              <div>收入来源：{incomeSourceLabel(data.income_source)}</div>
              <div className="col-span-full">住址：{data.address}</div>
            </div>
          </section>
          <section className="rounded-md border border-line bg-surface p-5 text-sm">
            <h3 className="mb-3 font-semibold">家庭成员</h3>
            {data.family_members.map((m, i) => (
              <div key={m.id || i} className="border-b border-line-light py-2 last:border-0">
                {m.name} · {m.age}岁 · {relationLabel(m.relation)} · {m.work_unit}
              </div>
            ))}
          </section>
          <section className="rounded-md border border-line bg-surface p-5 text-sm">
            <h3 className="mb-2 font-semibold">申请理由</h3>
            <p className="whitespace-pre-wrap">{data.reason}</p>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-md border border-line bg-surface p-5 text-sm">
            <div className="mb-2 flex justify-between"><span className="text-ink-soft">当前级别</span><span>{levelName(data.current_level)}</span></div>
            {reviewable ? (
              <div className="mt-4 flex flex-col gap-2">
                <Button onClick={() => setDialog("pass")} className="w-full"><Check size={16} /> 通过</Button>
                <Button variant="danger" onClick={() => setDialog("reject")} className="w-full"><Undo2 size={16} /> 退回</Button>
              </div>
            ) : withdrawable ? (
              <Button variant="outline" onClick={() => setWithdrawOpen(true)} className="mt-4 w-full">
                <RotateCcw size={16} /> 撤回审核意见
              </Button>
            ) : (
              <p className="mt-3 text-ink-mute">当前不在您的评审环节。</p>
            )}
          </section>
          {data.reviews.length > 0 && (
            <section className="rounded-md border border-line bg-surface p-5">
              <h3 className="mb-3 text-sm font-semibold">流转日志</h3>
              <ReviewLog records={data.reviews} />
            </section>
          )}
        </div>
      </div>

      <ReviewActionDialog
        open={dialog !== null}
        action={dialog ?? "pass"}
        currentLevel={level}
        requireDifficulty={false}
        loading={submitting}
        onConfirm={handleAction}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={withdrawOpen}
        title="撤回审核意见"
        description="确定撤回您最近一次助学金审核意见吗？"
        confirmText="确认撤回"
        loading={withdrawing}
        onConfirm={handleWithdraw}
        onCancel={() => setWithdrawOpen(false)}
      />
    </div>
  );
}
