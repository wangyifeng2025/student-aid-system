// 用户管理类型（与 backend/internal/dto/user.go 对齐）

import type { Role } from "@/types/auth";
import type { PageResult } from "@/types/student";

export type { PageResult };

export interface User {
  id: number;
  username: string;
  real_name: string;
  role: Role;
  phone: string;
  dept_id?: number | null;
  class_ids?: number[];
  status: number; // 1 启用 0 禁用
  created_at: string;
}

export interface UserCreateInput {
  username: string;
  password: string;
  real_name: string;
  role: Role;
  phone?: string;
  dept_id?: number | null;
  status?: number;
}

export interface UserUpdateInput {
  real_name: string;
  role: Role;
  phone?: string;
  dept_id?: number | null;
  status?: number;
}

export interface ResetPasswordInput {
  new_password: string;
}

export interface UserFilter {
  page?: number;
  page_size?: number;
  role?: string;
  status?: number;
  keyword?: string;
}
