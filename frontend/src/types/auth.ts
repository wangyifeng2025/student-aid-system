// 角色（与 backend/internal/model/enums.go 对齐）
export type Role =
  | "student"
  | "classadvisor"
  | "department"
  | "aidcenter"
  | "admin";

// 数据范围
export type DataScope = "self" | "class" | "department" | "school";

// 用户简要信息（对应后端 UserBrief）
export interface UserBrief {
  id: number;
  username: string;
  real_name: string;
  role: Role;
  dept_id?: number;
  class_id?: number;
  phone?: string;
}

// 登录 / 刷新令牌响应（对应后端 TokenResponse）
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: UserBrief;
}

// 登录请求
export interface LoginRequest {
  username: string;
  password: string;
}
