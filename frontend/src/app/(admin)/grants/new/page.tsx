"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { GrantForm } from "@/components/grant/grant-form";

export default function NewGrantPage() {
  const role = useAuthStore((s) => s.user?.role);
  const searchParams = useSearchParams();
  const recognitionId = Number(searchParams.get("recognition_id") || 0) || undefined;

  if (role && role !== "student") {
    return (
      <div className="rounded-md border border-line bg-surface px-6 py-10 text-center text-sm text-ink-soft">
        助学金申请仅限学生本人填报。
        <div className="mt-3">
          <Link href="/grants" className="text-link hover:underline">返回列表</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!recognitionId && (
        <div className="mb-4 rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
          请从已通过的困难认定详情页发起申请，或选择关联认定。
          <Link href="/recognitions" className="ml-2 text-link hover:underline">
            <ArrowLeft size={14} className="inline" /> 前往困难认定
          </Link>
        </div>
      )}
      <GrantForm mode="create" recognitionId={recognitionId} />
    </div>
  );
}
