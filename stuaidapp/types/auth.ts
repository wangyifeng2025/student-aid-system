// 角色与登录类型（与 backend/internal/model/enums.go、dto/auth.go 对齐）

export type Role = 'student' | 'classadvisor' | 'department' | 'aidcenter' | 'admin';

export type DataScope = 'self' | 'class' | 'department' | 'school';

export interface UserBrief {
  id: number;
  username: string;
  real_name: string;
  role: Role;
  dept_id?: number;
  class_ids?: number[];
  phone?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: UserBrief;
}

export interface LoginRequest {
  username: string;
  password: string;
}
