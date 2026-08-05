/** 困难认定申请表单类型（字段对齐 backend/internal/dto/recognition.go） */

export interface FamilyMemberInput {
  name: string;
  age: number;
  relation: string;
  work_unit: string;
  occupation: string;
  annual_income: number;
  health: string;
}

export interface RecognitionFormState {
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

export function emptyRecognitionForm(): RecognitionFormState {
  return {
    year: new Date().getFullYear(),
    nation: 'han',
    native_place: '',
    id_card: '',
    family_population: 1,
    phone: '',
    address: '',
    postal_code: '',
    guardian_phone: '',
    household_type: '',
    income_source: 'wage',
    special_types: [],
    natural_disaster: '',
    sudden_accident: '',
    weak_labor: '',
    unemployment: '',
    debt: '',
    other_info: '',
    commitment_agreed: false,
    family_members: [],
  };
}

export function emptyFamilyMember(): FamilyMemberInput {
  return {
    name: '',
    age: 0,
    relation: 'father',
    work_unit: '',
    occupation: 'worker',
    annual_income: 0,
    health: 'good',
  };
}

// ===== 认定审核（读取后端详情/列表，与 backend/internal/dto/recognition.go 对齐） =====

export type ApplicationStatus =
  | 'draft'
  | 'pending_class'
  | 'pending_dept'
  | 'pending_college'
  | 'pending_final'
  | 'approved'
  | 'rejected';

export type DifficultyLevel = '' | 'special' | 'hard' | 'general';

export interface RecognitionFamilyMember extends FamilyMemberInput {
  id: number;
  special_type: string;
}

export interface ReviewRecord {
  id: number;
  level: number;
  reviewer_id: number;
  reviewer_name: string;
  action: string;
  opinion: string;
  difficulty_level: string;
  reject_to_level: number;
  created_at: string;
}

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
}

export interface RecognitionDetail {
  id: number;
  student_id: number;
  student_no: string;
  student_name: string;
  status: ApplicationStatus;
  current_level: number;
  difficulty_level: DifficultyLevel;
  reject_reason: string;

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

  family_members: RecognitionFamilyMember[];
  reviews: ReviewRecord[];
}

export interface ReviewActionInput {
  difficulty_level?: string;
  opinion?: string;
  reject_to_level?: number;
}
