// 工作台概览（与 backend/internal/dto/dashboard.go、frontend/src/types/dashboard.ts 对齐）

export type DashboardKind = 'recognition' | 'grant';

export interface DashboardKPI {
  key: string;
  label: string;
  value: number;
  hint: string;
}

export interface DashboardItem {
  id: number;
  kind: DashboardKind;
  student_name: string;
  student_no: string;
  class_name: string;
  status: string;
  title: string;
}

export interface DashboardOverview {
  year: number;
  role: string;
  data_scope: string;
  scope_label: string;
  dept_name: string;
  class_name: string;
  kpis: DashboardKPI[];
  todos: DashboardItem[];
  recents: DashboardItem[];
}
