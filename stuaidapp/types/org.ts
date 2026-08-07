/** 组织机构简要类型（审核筛选用） */

export interface Department {
  id: number;
  name: string;
  code: string;
}

export interface OrgClass {
  id: number;
  dept_id: number;
  major_id: number;
  grade_id: number;
  name: string;
}
