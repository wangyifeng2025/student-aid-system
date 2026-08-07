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

/** 角色在某状态下是否可执行助学金评审（与认定审核级别规则一致）。 */
export function canReviewGrant(role: string | undefined, status: GrantStatus): boolean {
  if (!role) return false;
  switch (status) {
    case 'pending_class':
      return role === 'classadvisor' || role === 'admin';
    case 'pending_dept':
      return role === 'department' || role === 'admin';
    case 'pending_college':
      return role === 'aidcenter' || role === 'admin';
    default:
      return false;
  }
}

export function grantTodoStatusOptionsForRole(role: string | undefined) {
  switch (role) {
    case 'classadvisor':
      return [{ value: 'pending_class', label: grantStatusMeta('pending_class').label }];
    case 'department':
      return [{ value: 'pending_dept', label: grantStatusMeta('pending_dept').label }];
    case 'aidcenter':
      return [{ value: 'pending_college', label: grantStatusMeta('pending_college').label }];
    case 'admin':
      return (['pending_class', 'pending_dept', 'pending_college'] as GrantStatus[]).map((v) => ({
        value: v,
        label: grantStatusMeta(v).label,
      }));
    default:
      return [];
  }
}

export function grantRecordsTodoStatusOptionsForRole(role: string | undefined) {
  switch (role) {
    case 'classadvisor':
      return [{ value: 'pending_class', label: grantStatusMeta('pending_class').label }];
    case 'department':
      return (['pending_class', 'pending_dept'] as GrantStatus[]).map((v) => ({
        value: v,
        label: grantStatusMeta(v).label,
      }));
    case 'aidcenter':
    case 'admin':
      return (['pending_class', 'pending_dept', 'pending_college'] as GrantStatus[]).map((v) => ({
        value: v,
        label: grantStatusMeta(v).label,
      }));
    default:
      return [];
  }
}
