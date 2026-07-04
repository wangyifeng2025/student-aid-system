import type { Role } from "@/types/auth";

export const ROLE_LABELS: Record<Role, string> = {
  student: "学生",
  classadvisor: "班主任/辅导员",
  department: "教学系经办人",
  aidcenter: "资助中心",
  admin: "系统管理员",
};

export function roleLabel(role?: Role): string {
  return role ? (ROLE_LABELS[role] ?? role) : "";
}

// 取姓名/用户名首字符作为头像占位。
export function avatarInitial(name?: string): string {
  if (!name) return "用";
  return name.trim().charAt(0) || "用";
}
