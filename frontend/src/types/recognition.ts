// 困难认定申请类型（与 backend/internal/dto/recognition.go 对齐）

import type { PageResult } from "@/types/student";

export type { PageResult };

// 申请状态（与 backend/internal/model/enums.go ApplicationStatus 对齐）
export type ApplicationStatus =
  | "draft"
  | "pending_class"
  | "pending_dept"
  | "pending_college"
  | "pending_final"
  | "approved"
  | "rejected";

// 困难等级（与 difficulty_level 字典对齐，未评定为空串）
export type DifficultyLevel = "" | "special" | "hard" | "general";

// 户口类型
export type HouseholdType = "" | "urban" | "rural";

// 家庭成员录入项
export interface FamilyMemberInput {
  name: string;
  age: number;
  relation: string; // 字典 relation
  work_unit: string;
  occupation: string; // 字典 occupation
  annual_income: number;
  health: string; // 字典 health_status
  special_type: string; // 特殊群体类型（可空）
}

// 家庭成员响应
export interface FamilyMember extends FamilyMemberInput {
  id: number;
}

// 认定申请创建/修改请求（草稿与提交共用）
export interface RecognitionInput {
  year: number;

  nation: string;
  native_place: string;
  id_card: string;
  family_population: number;
  phone: string;
  address: string;
  postal_code: string;
  guardian_phone: string;

  household_type: string;
  per_capita_annual_income: number;
  income_source: string;

  special_types: string[];

  natural_disaster: string;
  sudden_accident: string;
  weak_labor: string;
  unemployment: string;
  debt: string;
  other_info: string;

  commitment_agreed: boolean;

  family_members: FamilyMemberInput[];
}

// 评审动作
export type ReviewActionType = "pass" | "reject";

// 评审流转记录（与 backend/internal/dto/review.go ReviewRecordResponse 对齐）
export interface ReviewRecord {
  id: number;
  level: number;
  reviewer_id: number;
  reviewer_name: string;
  action: ReviewActionType | string;
  opinion: string;
  difficulty_level: DifficultyLevel | string;
  reject_to_level: number;
  created_at: string;
}

// 认定申请详情响应
export interface Recognition extends RecognitionInput {
  id: number;
  student_id: number;
  student_no: string;
  student_name: string;
  dept_name: string;
  class_name: string;
  status: ApplicationStatus;
  current_level: number;
  difficulty_level: DifficultyLevel;
  reject_reason: string;
  family_members: FamilyMember[];
  reviews: ReviewRecord[];
}

// 单条评审动作请求
export interface ReviewActionInput {
  difficulty_level?: string;
  opinion?: string;
  reject_to_level?: number;
}

// 批量评审请求
export interface BatchReviewInput {
  ids: number[];
  action: ReviewActionType;
  difficulty_level?: string;
  opinion?: string;
  reject_to_level?: number;
}

// 批量评审单条结果
export interface BatchReviewItemResult {
  id: number;
  ok: boolean;
  message?: string;
}

// 批量评审汇总结果
export interface BatchReviewResult {
  total: number;
  success: number;
  failed: number;
  items: BatchReviewItemResult[];
}

// 认定申请列表项
export interface RecognitionListItem {
  id: number;
  student_id: number;
  student_no: string;
  student_name: string;
  dept_name: string;
  major_name: string;
  class_name: string;
  year: number;
  status: ApplicationStatus;
  current_level: number;
  difficulty_level: DifficultyLevel;
  per_capita_annual_income: number;
  special_types: string[];
  /** 低收入证明材料份数（不含签字图）。 */
  proof_count: number;
}

// 提交结果：申请快照 + 非阻断性提示
export interface SubmitResult {
  application: Recognition;
  warnings: string[];
}

// 附件响应
export interface Attachment {
  id: number;
  owner_type: string;
  owner_id: number;
  file_name: string;
  size: number;
  mime: string;
  uploader_id: number;
}

// 列表筛选
export interface RecognitionFilter {
  page?: number;
  page_size?: number;
  year?: number;
  status?: string;
  keyword?: string;
  special_type?: string;
  dept_id?: number;
  class_id?: number;
  tab?: "todo" | "done" | "all";
  ids?: number[];
  scope?: "todo" | "approved";
}
