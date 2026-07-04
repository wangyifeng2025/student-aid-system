// 组织机构相关类型（与 backend/internal/dto/org.go 对齐）

export interface Department {
  id: number;
  name: string;
  code: string;
}

export interface Major {
  id: number;
  dept_id: number;
  name: string;
  code: string;
}

export interface Grade {
  id: number;
  name: string;
  year: number;
}

export interface Class {
  id: number;
  dept_id: number;
  major_id: number;
  grade_id: number;
  name: string;
  advisor_id?: number | null;
}

// ===== 请求体 =====

export interface DepartmentInput {
  name: string;
  code?: string;
}

export interface MajorInput {
  dept_id: number;
  name: string;
  code?: string;
}

export interface GradeInput {
  name: string;
  year: number;
}

export interface ClassInput {
  dept_id: number;
  major_id?: number;
  grade_id?: number;
  name: string;
  advisor_id?: number | null;
}
