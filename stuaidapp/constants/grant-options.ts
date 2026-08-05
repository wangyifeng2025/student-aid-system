// 助学金展示辅助，与 frontend/src/lib/grant-options.ts 对齐。

import { STATUS_META } from '@/constants/review-options';
import type { ApplicationStatus } from '@/types/recognition';
import type { GrantStatus } from '@/types/grant';

export const GRANT_TYPE_LABELS: Record<string, string> = {
  national_aid: '国家助学金',
};

export function grantTypeLabel(t: string): string {
  return GRANT_TYPE_LABELS[t] ?? t;
}

type StatusMeta = { label: string; color: string; bg: string };

export function grantStatusMeta(status: GrantStatus): StatusMeta {
  return STATUS_META[status as ApplicationStatus] ?? {
    label: status,
    color: STATUS_META.draft.color,
    bg: STATUS_META.draft.bg,
  };
}

export function canEditGrant(status: GrantStatus): boolean {
  return status === 'draft' || status === 'rejected';
}
