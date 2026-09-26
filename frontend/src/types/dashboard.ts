export type DashboardKind = "recognition" | "grant";

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

export interface DashboardClassProgress {
  class_id: number;
  class_name: string;
  pending_class: number;
  pending_dept: number;
  pending_college: number;
  total: number;
}

export interface DashboardDeptProgress {
  dept_id: number;
  dept_name: string;
  pending_class: number;
  pending_dept: number;
  pending_college: number;
  total: number;
  classes: DashboardClassProgress[];
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
  review_progress?: DashboardDeptProgress[];
}
