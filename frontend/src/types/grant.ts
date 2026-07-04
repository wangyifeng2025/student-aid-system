import type { PageResult, ReviewRecord } from "@/types/recognition";

export type { PageResult };

export type GrantType = "national_aid";

export type GrantStatus =
  | "draft"
  | "pending_class"
  | "pending_dept"
  | "pending_college"
  | "approved"
  | "rejected";

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
  reviews: ReviewRecord[];
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

export interface GrantFilter {
  page?: number;
  page_size?: number;
  year?: number;
  status?: string;
  grant_type?: string;
  keyword?: string;
  tab?: "all" | "todo" | "done";
}
