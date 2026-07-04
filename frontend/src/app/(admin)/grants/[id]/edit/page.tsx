"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { grantApi, ApiError } from "@/lib/api";
import { GrantForm } from "@/components/grant/grant-form";
import { LoadingState, ErrorState } from "@/components/ui/states";
import type { Grant } from "@/types/grant";

export default function EditGrantPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [data, setData] = React.useState<Grant | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        setData(await grantApi.get(id));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState label={error} />;
  if (!data) return null;

  return (
    <div>
      <GrantForm mode="edit" grantId={id} initial={data} />
    </div>
  );
}
