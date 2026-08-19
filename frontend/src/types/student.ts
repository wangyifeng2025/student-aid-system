// 学生与重点人群类型（与 backend/internal/dto/student.go 对齐）

// 通用分页结果
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ===== 学生 Student =====

export interface Student {
  id: number;
  user_id: number;
  student_no: string;
  name: string;
  gender: string;
  birth: string; // YYYY-MM-DD，可能为空串
  nation: string;
  political_status: string;
  id_card: string;
  phone: string;
  enroll_time: string; // YYYY-MM-DD，可能为空串
  dept_id: number;
  major_id: number;
  class_id: number;
  dept_name?: string;
  class_name?: string;
  is_key_group: boolean;
  // 仅新建时返回，用于提示初始密码；其余场景为空
  initial_password?: string;
}

export interface StudentInput {
  student_no: string;
  name: string;
  gender: string;
  id_card: string;
  birth?: string;
  nation?: string;
  political_status?: string;
  phone?: string;
  enroll_time?: string;
  dept_id?: number;
  major_id?: number;
  class_id?: number;
}

export interface StudentFilter {
  page?: number;
  page_size?: number;
  dept_id?: number;
  major_id?: number;
  class_id?: number;
  keyword?: string;
  is_key_group?: boolean;
}

// ===== 重点人群 SpecialGroup =====

export interface SpecialGroup {
  id: number;
  student_no: string;
  id_card: string;
  name: string;
  type: string;
  source: string;
  batch: string;
  year: number;
}

export interface SpecialGroupInput {
  student_no?: string;
  id_card?: string;
  name?: string;
  type: string;
  source?: string;
  batch?: string;
  year?: number;
}

export interface SpecialGroupFilter {
  page?: number;
  page_size?: number;
  type?: string;
  year?: number;
  keyword?: string;
}

// ===== Excel 导入 =====

export interface ImportRowError {
  row: number;
  column: string;
  message: string;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: ImportRowError[];
}
