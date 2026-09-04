// 三级评审展示与权限辅助（与 frontend/src/lib/recognition-options.ts 的评审部分对齐）

import { Brand } from '@/constants/brand';
import type { Role } from '@/types/auth';
import type { ApplicationStatus, DifficultyLevel } from '@/types/recognition';

export interface Option {
  value: string;
  label: string;
}

export const DIFFICULTY_OPTIONS: Option[] = [
  { value: 'special', label: '特别困难' },
  { value: 'hard', label: '困难' },
  { value: 'general', label: '一般困难' },
];

export function difficultyLabel(v: DifficultyLevel | string): string {
  if (!v) return '未评定';
  return DIFFICULTY_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

type StatusMeta = { label: string; color: string; bg: string };

export const STATUS_META: Record<ApplicationStatus, StatusMeta> = {
  draft: { label: '草稿', color: Brand.mutedForeground, bg: Brand.inputBackground },
  pending_class: { label: '待班级评审', color: Brand.info, bg: Brand.infoSurface },
  pending_dept: { label: '待教学系评审', color: Brand.warning, bg: Brand.warningSurface },
  pending_college: { label: '待院级评审', color: Brand.warning, bg: Brand.warningSurface },
  pending_final: { label: '待院级评审（历史）', color: Brand.warning, bg: Brand.warningSurface },
  approved: { label: '认定通过', color: Brand.success, bg: Brand.successSurface },
  rejected: { label: '已退回', color: Brand.error, bg: Brand.errorSurface },
};

export function statusMeta(status: ApplicationStatus): StatusMeta {
  return STATUS_META[status] ?? { label: status, color: Brand.mutedForeground, bg: Brand.inputBackground };
}

/** 认定申请学生本人是否可编辑/续填（仅草稿或被退回状态，与后端 isEditable 对齐）。 */
export function canEditRecognition(status: ApplicationStatus): boolean {
  return status === 'draft' || status === 'rejected';
}

/** 已提交且班级尚未审核时可撤回。 */
export function canWithdrawRecognition(
  status: ApplicationStatus,
  reviews?: { level: number }[],
): boolean {
  if (status !== 'pending_class') return false;
  if (!reviews?.length) return true;
  return !reviews.some((r) => r.level === 1);
}

/** 草稿/退回，或已提交且班级尚未审核时可删除。 */
export function canDeleteRecognition(
  status: ApplicationStatus,
  reviews?: { level: number }[],
): boolean {
  if (canEditRecognition(status)) return true;
  return canWithdrawRecognition(status, reviews);
}

/** 当前状态对应的评审级别（1~3），非待审状态返回 0；pending_final 兼容历史数据。 */
export function actingLevel(status: ApplicationStatus): number {
  switch (status) {
    case 'pending_class':
      return 1;
    case 'pending_dept':
      return 2;
    case 'pending_college':
    case 'pending_final':
      return 3;
    default:
      return 0;
  }
}

/** 角色在某状态下是否可执行评审动作（与后端 roleCanActLevel + statusLevel 对齐）。 */
export function canReview(role: Role | undefined, status: ApplicationStatus): boolean {
  if (!role) return false;
  switch (status) {
    case 'pending_class':
      return role === 'classadvisor' || role === 'admin';
    case 'pending_dept':
      return role === 'department' || role === 'admin';
    case 'pending_college':
    case 'pending_final':
      return role === 'aidcenter' || role === 'admin';
    default:
      return false;
  }
}

/** 班主任 / 教学系 / 资助中心 / 管理员可导出认定结果汇总表。 */
export function canExportRecognitionSummary(role: Role | undefined): boolean {
  return role === 'classadvisor' || role === 'department' || role === 'aidcenter' || role === 'admin';
}

/**
 * 评审人是否可撤回本人最近一次审核意见。
 * 条件：最后一条评审为自己提交，且下级（如教学系）尚未继续审核。
 */
export function canWithdrawReview(
  role: Role | undefined,
  userId: number | undefined,
  reviews?: { level: number; reviewer_id: number }[],
): boolean {
  if (!role || role === 'student' || !userId || !reviews?.length) return false;
  const last = reviews[reviews.length - 1];
  if (last.reviewer_id !== userId) return false;
  switch (role) {
    case 'classadvisor':
      return last.level === 1;
    case 'department':
      return last.level === 2;
    case 'aidcenter':
      return last.level === 3 || last.level === 4;
    case 'admin':
      return last.level >= 1 && last.level <= 4;
    default:
      return false;
  }
}

/** 退回目标选项：可退回到学生或任意更低级别。 */
export function rejectTargetOptions(currentLevel: number): Option[] {
  const all: Option[] = [
    { value: '0', label: '退回学生重填' },
    { value: '1', label: '退回班主任（班级）' },
    { value: '2', label: '退回教学系' },
    { value: '3', label: '退回资助中心（院级）' },
  ];
  return all.filter((o) => Number(o.value) < currentLevel);
}

const LEVEL_NAMES = ['—', '班级评审', '教学系评审', '院级评审'];

export function levelName(level: number): string {
  return LEVEL_NAMES[level] ?? '—';
}

export function reviewActionLabel(action: string): string {
  if (action === 'pass') return '通过';
  if (action === 'reject') return '退回';
  return action;
}

/** 本级待办状态筛选项。 */
export function todoStatusOptionsForRole(role: Role | undefined): Option[] {
  switch (role) {
    case 'classadvisor':
      return [{ value: 'pending_class', label: STATUS_META.pending_class.label }];
    case 'department':
      return [{ value: 'pending_dept', label: STATUS_META.pending_dept.label }];
    case 'aidcenter':
      return [{ value: 'pending_college', label: STATUS_META.pending_college.label }];
    case 'admin':
      return (['pending_class', 'pending_dept', 'pending_college'] as const).map((v) => ({
        value: v,
        label: STATUS_META[v].label,
      }));
    default:
      return [];
  }
}

/** 记录「待审核/在途」标签状态筛选项（本级 + 下级待审）。 */
export function recordsTodoStatusOptionsForRole(role: Role | undefined): Option[] {
  switch (role) {
    case 'classadvisor':
      return [{ value: 'pending_class', label: STATUS_META.pending_class.label }];
    case 'department':
      return (['pending_class', 'pending_dept'] as const).map((v) => ({
        value: v,
        label: STATUS_META[v].label,
      }));
    case 'aidcenter':
    case 'admin':
      return (['pending_class', 'pending_dept', 'pending_college'] as const).map((v) => ({
        value: v,
        label: STATUS_META[v].label,
      }));
    default:
      return [];
  }
}
