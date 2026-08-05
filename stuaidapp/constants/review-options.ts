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
  { value: 'hard', label: '比较困难' },
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

/** 认定申请学生本人是否可撤回（已提交但尚未经过班级评审）。 */
export function canWithdrawRecognition(status: ApplicationStatus): boolean {
  return status === 'pending_class';
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
