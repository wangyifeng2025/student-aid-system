"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, Pencil } from "lucide-react";
import { grantApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { GrantStatusBadge } from "@/components/grant/grant-status-badge";
import { ReviewLog } from "@/components/review/review-log";
import { canEditGrant, grantTypeLabel } from "@/lib/grant-options";
import { householdLabel, incomeSourceLabel, relationLabel, nationLabel } from "@/lib/recognition-options";
import type { Grant } from "@/types/grant";

export default function GrantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const role = useAuthStore((s) => s.user?.role);
  const isStudent = role === "student";

  const [data, setData] = React.useState<Grant | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await grantApi.get(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleExport = async () => {
    try {
      await grantApi.exportPdf(id);
      toast.success("PDF 已开始下载");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "导出失败");
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState label={error} onRetry={load} />;
  if (!data) return null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/grants" className="inline-flex items-center gap-1.5 text-sm text-link hover:underline">
          <ArrowLeft size={16} /> 返回列表
        </Link>
        <div className="flex gap-2">
          {isStudent && canEditGrant(data.status) && (
            <Link href={`/grants/${id}/edit`}>
              <Button variant="outline" size="sm"><Pencil size={16} /> 继续编辑</Button>
            </Link>
          )}
          {data.status === "approved" && (
            <Button size="sm" onClick={handleExport}><Download size={16} /> 导出 PDF</Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">国家助学金申请 — {data.year} 年度</h2>
        <GrantStatusBadge status={data.status} />
      </div>

      {data.reject_reason && (
        <div className="mb-4 rounded-md px-3 py-2 text-sm" style={{ background: "var(--state-error-bg)", color: "var(--state-error)" }}>
          退回意见：{data.reject_reason}
        </div>
      )}

      <div className="space-y-4">
        <section className="rounded-md border border-line bg-surface p-5">
          <h3 className="mb-3 font-semibold text-ink">本人情况</h3>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
            <div>姓名：{data.student_name}</div>
            <div>学号：{data.student_no}</div>
            <div>性别：{data.gender === "male" ? "男" : data.gender === "female" ? "女" : data.gender}</div>
            <div>民族：{nationLabel(data.nation)}</div>
            <div>年级：{data.grade_name}</div>
            <div>类型：{grantTypeLabel(data.grant_type)}</div>
            <div className="col-span-full">院系专业班级：{data.school_unit}</div>
            <div>联系电话：{data.phone}</div>
          </div>
        </section>

        <section className="rounded-md border border-line bg-surface p-5">
          <h3 className="mb-3 font-semibold text-ink">家庭经济情况</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>户口：{householdLabel(data.household_type)}</div>
            <div>家庭总人数：{data.family_population} 人</div>
            <div>家庭月总收入：¥{data.monthly_income.toLocaleString()}</div>
            <div>人均月收入：¥{data.per_capita_monthly_income.toLocaleString()}</div>
            <div>收入来源：{incomeSourceLabel(data.income_source)}</div>
            <div>邮编：{data.postal_code}</div>
            <div className="col-span-full">住址：{data.address}</div>
          </div>
        </section>

        <section className="rounded-md border border-line bg-surface p-5">
          <h3 className="mb-3 font-semibold text-ink">家庭成员</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-soft">
                <th className="py-1">姓名</th><th>年龄</th><th>关系</th><th>单位</th>
              </tr>
            </thead>
            <tbody>
              {data.family_members.map((m, i) => (
                <tr key={m.id || i} className="border-t border-line-light">
                  <td className="py-2">{m.name}</td>
                  <td>{m.age}</td>
                  <td>{relationLabel(m.relation)}</td>
                  <td>{m.work_unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-md border border-line bg-surface p-5">
          <h3 className="mb-2 font-semibold text-ink">申请理由</h3>
          <p className="whitespace-pre-wrap text-sm text-ink">{data.reason || "—"}</p>
        </section>

        {data.reviews.length > 0 && (
          <section className="rounded-md border border-line bg-surface p-5">
            <h3 className="mb-3 font-semibold text-ink">审批流转</h3>
            <ReviewLog records={data.reviews} />
          </section>
        )}
      </div>
    </div>
  );
}
