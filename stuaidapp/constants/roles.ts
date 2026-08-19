import type { Role } from '@/types/auth';

export const ROLE_LABELS: Record<Role, string> = {
  student: '学生',
  classadvisor: '班主任 / 辅导员',
  department: '教学系经办人',
  aidcenter: '资助中心',
  admin: '系统管理员',
};

/** 欢迎页身份：学生 / 老师；资助中心与管理员单独标明。 */
export function welcomeIdentityLabel(role?: Role): string {
  if (!role) return '';
  if (role === 'student') return '学生';
  if (role === 'aidcenter') return '资助中心';
  if (role === 'admin') return '管理员';
  return '老师';
}
