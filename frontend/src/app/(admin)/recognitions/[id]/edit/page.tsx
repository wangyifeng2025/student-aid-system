"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { recognitionApi, ApiError } from "@/lib/api";
import { toast } from "@/store/toast";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { RecognitionForm } from "@/components/recognition/recognition-form";
import type { Recognition } from "@/types/recognition";

export default function EditRecognitionPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const [data, setData] = React.useState<Recognition | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await recognitionApi.get(id);
      if (res.status !== "draft" && res.status !== "rejected") {
        toast.info("该申请当前状态不可编辑，已跳转至详情");
        router.replace(`/recognitions/${id}`);
        return;
      }
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/recognitions/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-link hover:underline"
        >
          <ArrowLeft size={16} />
          返回详情
        </Link>
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState label={error} onRetry={load} />
      ) : data ? (
        <RecognitionForm mode="edit" initial={data} />
      ) : null}
    </div>
  );
}
