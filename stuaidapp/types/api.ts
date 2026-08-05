// 通用 API 响应与分页类型（与 backend pkg/response 对齐）

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
