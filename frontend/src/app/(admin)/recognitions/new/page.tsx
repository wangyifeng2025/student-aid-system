"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { RecognitionForm } from "@/components/recognition/recognition-form";

export default function NewRecognitionPage() {
  const role = useAuthStore((s) => s.user?.role);

  if (role && role !== "student") {
    return (
      <div className="rounded-md border border-line bg-surface px-6 py-10 text-center text-sm text-ink-soft">
        困难认定申请仅限学生本人填报。
        <div className="mt-3">
          <Link href="/recognitions" className="text-link hover:underline">
            返回认定申请列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/recognitions"
          className="inline-flex items-center gap-1.5 text-sm text-link hover:underline"
        >
          <ArrowLeft size={16} />
          返回列表
        </Link>
      </div>
      <RecognitionForm mode="create" />
    </div>
  );
}
