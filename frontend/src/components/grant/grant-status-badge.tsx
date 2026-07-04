import { Badge } from "@/components/ui/badge";
import { grantStatusMeta } from "@/lib/grant-options";
import type { GrantStatus } from "@/types/grant";

export function GrantStatusBadge({ status }: { status: GrantStatus }) {
  const { label, tone } = grantStatusMeta(status);
  return <Badge tone={tone}>{label}</Badge>;
}
