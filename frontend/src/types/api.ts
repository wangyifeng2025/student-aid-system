// 后端统一响应结构：{ code, message, data }
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

// 业务码（与 backend/pkg/response 对齐）
export const ApiCode = {
  OK: 0,
  BadRequest: 40000,
  Unauthorized: 40100,
  Forbidden: 40300,
  NotFound: 40400,
  Conflict: 40900,
  ServerError: 50000,
} as const;
