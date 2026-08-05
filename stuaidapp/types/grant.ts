/** 助学金申请表单类型（字段对齐 backend/internal/dto/grant.go、frontend/src/types/grant.ts） */

export type GrantType = 'national_aid';

export type GrantStatus =
  | 'draft'
  | 'pending_class'
  | 'pending_dept'
  | 'pending_college'
  | 'approved'
  | 'rejected';

export interface GrantFamilyMemberInput {
  name: string;
  age: number;
  relation: string;
  work_unit: string;
}

export interface GrantFamilyMember extends GrantFamilyMemberInput {
  id: number;
}

export interface GrantInput {
  year: number;
  phone: string;
  household_type: string;
  family_population: number;
  monthly_income: number;
  per_capita_monthly_income: number;
  income_source: string;
  address: string;
  postal_code: string;
  reason: string;
  family_members: GrantFamilyMemberInput[];
}

export interface GrantReviewRecord {
  id: number;
  level: number;
  reviewer_id: number;
  reviewer_name: string;
  action: string;
  opinion: string;
  reject_to_level: number;
  created_at: string;
}

export interface Grant extends GrantInput {
  id: number;
  student_id: number;
  student_no: string;
  student_name: string;
  recognition_id: number;
  grant_type: GrantType;
  status: GrantStatus;
  current_level: number;
  reject_reason: string;
  gender: string;
  birth: string;
  nation: string;
  political_status: string;
  enroll_time: string;
  id_card: string;
  grade_name: string;
  school_unit: string;
  family_members: GrantFamilyMember[];
  reviews: GrantReviewRecord[];
}

export interface GrantListItem {
  id: number;
  student_id: number;
  student_no: string;
  student_name: string;
  dept_name: string;
  major_name: string;
  class_name: string;
  year: number;
  grant_type: GrantType;
  status: GrantStatus;
  current_level: number;
}

export interface CreateGrantInput {
  recognition_id: number;
  grant_type?: GrantType;
}

export function emptyGrantMember(): GrantFamilyMemberInput {
  return { name: '', age: 0, relation: '', work_unit: '' };
}

export function grantInputFromGrant(g: Grant): GrantInput {
  return {
    year: g.year,
    phone: g.phone,
    household_type: g.household_type,
    family_population: g.family_population,
    monthly_income: g.monthly_income,
    per_capita_monthly_income: g.per_capita_monthly_income,
    income_source: g.income_source,
    address: g.address,
    postal_code: g.postal_code,
    reason: g.reason,
    family_members: g.family_members.map(({ name, age, relation, work_unit }) => ({
      name,
      age,
      relation,
      work_unit,
    })),
  };
}
