import { Badge } from "@/components/ui/badge";
import { statusMeta } from "@/lib/recognition-options";
import type { ApplicationStatus } from "@/types/recognition";

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = statusMeta(status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
