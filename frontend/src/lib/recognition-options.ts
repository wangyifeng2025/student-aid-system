// 困难认定填报用内置选项常量。
// 注意：后端 /dicts 接口仅管理员可读，学生无法拉取，故这里内置与
// backend/cmd/seed/dicts.go 完全对齐的编码-标签映射，作为填报下拉的数据源。

import type { ApplicationStatus, DifficultyLevel } from "@/types/recognition";

export interface Option {
  value: string;
  label: string;
}

// 民族（nation）
export const NATION_OPTIONS: Option[] = [
  { value: "han", label: "汉族" },
  { value: "zhuang", label: "壮族" },
  { value: "hui", label: "回族" },
  { value: "man", label: "满族" },
  { value: "uygur", label: "维吾尔族" },
  { value: "miao", label: "苗族" },
  { value: "yi", label: "彝族" },
  { value: "tujia", label: "土家族" },
  { value: "zang", label: "藏族" },
  { value: "mongol", label: "蒙古族" },
  { value: "buyi", label: "布依族" },
  { value: "dong", label: "侗族" },
  { value: "other", label: "其他" },
];

// 与学生关系（relation）
export const RELATION_OPTIONS: Option[] = [
  { value: "father", label: "父亲" },
  { value: "mother", label: "母亲" },
  { value: "elder_brother", label: "哥哥" },
  { value: "younger_brother", label: "弟弟" },
  { value: "elder_sister", label: "姐姐" },
  { value: "younger_sister", label: "妹妹" },
  { value: "grandfather", label: "祖父" },
  { value: "grandmother", label: "祖母" },
  { value: "other", label: "其他" },
];

// 职业（occupation）
export const OCCUPATION_OPTIONS: Option[] = [
  { value: "worker", label: "务工" },
  { value: "farmer", label: "务农" },
  { value: "none", label: "无" },
  { value: "student", label: "读书" },
  { value: "other", label: "其他" },
];

// 健康状况（health_status）
export const HEALTH_OPTIONS: Option[] = [
  { value: "good", label: "良好" },
  { value: "poor", label: "较差" },
  { value: "disabled", label: "残疾" },
];

// 收入来源（income_source）
export const INCOME_SOURCE_OPTIONS: Option[] = [
  { value: "wage", label: "工资性收入" },
  { value: "farming", label: "务农收入" },
  { value: "business", label: "经营性收入" },
  { value: "subsidy", label: "补助/低保" },
  { value: "other", label: "其他" },
];

// 户口类型（household_type）
export const HOUSEHOLD_OPTIONS: Option[] = [
  { value: "urban", label: "城镇" },
  { value: "rural", label: "农村" },
];

// 特殊群体类型（special_group_type）
export const SPECIAL_GROUP_OPTIONS: Option[] = [
  { value: "poverty", label: "脱贫家庭学生" },
  { value: "poverty_unstable", label: "脱贫不稳定家庭学生" },
  { value: "marginal", label: "边缘易致贫家庭学生" },
  { value: "sudden_difficulty", label: "突发严重困难家庭学生" },
  { value: "low_income", label: "低保家庭学生" },
  { value: "low_income_margin", label: "低保边缘家庭学生" },
  { value: "extreme_poverty", label: "特困救助供养学生" },
  { value: "rigid_expenditure", label: "刚性支出困难家庭学生" },
  { value: "other_low_income", label: "其他低收入学生" },
  { value: "orphan", label: "孤儿" },
  { value: "no_guardian", label: "事实无人抚养儿童" },
  { value: "disabled_student", label: "残疾学生" },
  { value: "disabled_parent", label: "残疾人子女" },
  { value: "martyr_child", label: "烈士子女" },
];

// 困难等级（difficulty_level）
export const DIFFICULTY_OPTIONS: Option[] = [
  { value: "special", label: "特别困难" },
  { value: "hard", label: "比较困难" },
  { value: "general", label: "一般困难" },
];

function labelOf(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export const nationLabel = (v: string) => (v ? labelOf(NATION_OPTIONS, v) : "—");
export const relationLabel = (v: string) => (v ? labelOf(RELATION_OPTIONS, v) : "—");
export const occupationLabel = (v: string) => (v ? labelOf(OCCUPATION_OPTIONS, v) : "—");
export const healthLabel = (v: string) => (v ? labelOf(HEALTH_OPTIONS, v) : "—");
export const incomeSourceLabel = (v: string) => (v ? labelOf(INCOME_SOURCE_OPTIONS, v) : "—");
export const householdLabel = (v: string) => (v ? labelOf(HOUSEHOLD_OPTIONS, v) : "—");
export const specialGroupLabel = (v: string) => (v ? labelOf(SPECIAL_GROUP_OPTIONS, v) : v);

export function difficultyLabel(v: DifficultyLevel | string): string {
  return v ? labelOf(DIFFICULTY_OPTIONS, v) : "未评定";
}

// 状态元信息：展示标签 + 徽章色调。
import type { Tone } from "@/components/ui/badge";

export const STATUS_META: Record<
  ApplicationStatus,
  { label: string; tone: Tone }
> = {
  draft: { label: "草稿", tone: "neutral" },
  pending_class: { label: "待班级评审", tone: "info" },
  pending_dept: { label: "待教学系评审", tone: "warning" },
  pending_college: { label: "待院级评审", tone: "warning" },
  pending_final: { label: "待第四级确认", tone: "warning" },
  approved: { label: "认定通过", tone: "success" },
  rejected: { label: "已退回", tone: "error" },
};

export function statusMeta(status: ApplicationStatus): {
  label: string;
  tone: Tone;
} {
  return STATUS_META[status] ?? { label: status, tone: "neutral" };
}

// 困难等级徽章色调。
export function difficultyTone(v: DifficultyLevel | string): Tone {
  switch (v) {
    case "special":
      return "error";
    case "hard":
      return "warning";
    case "general":
      return "neutral";
    default:
      return "neutral";
  }
}

// 评审流程级别（current_level）→ 名称。
export const LEVEL_NAMES = ["—", "班级评审", "教学系评审", "院级评审", "第四级确认"];

export function levelName(level: number): string {
  return LEVEL_NAMES[level] ?? "—";
}

// ===== 模块 5：评审与退回 =====

import type { Role } from "@/types/auth";

// 角色在某状态下是否可执行评审动作（与后端 roleCanActLevel + statusLevel 对齐）。
export function canReview(role: Role | undefined, status: ApplicationStatus): boolean {
  if (!role) return false;
  switch (status) {
    case "pending_class":
      return role === "classadvisor" || role === "admin";
    case "pending_dept":
      return role === "department" || role === "admin";
    case "pending_college":
    case "pending_final":
      return role === "aidcenter" || role === "admin";
    default:
      return false;
  }
}

// 角色待办状态筛选项（与后端 todoStatusesForRole 对齐）。
export function todoStatusOptionsForRole(role: Role | undefined): { value: ApplicationStatus; label: string }[] {
  switch (role) {
    case "classadvisor":
      return [{ value: "pending_class", label: STATUS_META.pending_class.label }];
    case "department":
      return [{ value: "pending_dept", label: STATUS_META.pending_dept.label }];
    case "aidcenter":
      return [
        { value: "pending_college", label: STATUS_META.pending_college.label },
        { value: "pending_final", label: STATUS_META.pending_final.label },
      ];
    case "admin":
      return (
        [
          "pending_class",
          "pending_dept",
          "pending_college",
          "pending_final",
        ] as ApplicationStatus[]
      ).map((v) => ({ value: v, label: STATUS_META[v].label }));
    default:
      return [];
  }
}

/** 认定记录页状态筛选项（不含草稿）。 */
export const RECORDS_STATUS_OPTIONS = (
  Object.keys(STATUS_META) as ApplicationStatus[]
)
  .filter((s) => s !== "draft")
  .map((value) => ({ value, label: STATUS_META[value].label }));

// 当前状态对应的评审级别（1~4），非待审状态返回 0。
export function actingLevel(status: ApplicationStatus): number {
  switch (status) {
    case "pending_class":
      return 1;
    case "pending_dept":
      return 2;
    case "pending_college":
      return 3;
    case "pending_final":
      return 4;
    default:
      return 0;
  }
}

// 退回目标选项：可退回到学生或任意更低级别。
export function rejectTargetOptions(currentLevel: number): Option[] {
  const all: Option[] = [
    { value: "0", label: "退回学生重填" },
    { value: "1", label: "退回班主任（班级）" },
    { value: "2", label: "退回教学系" },
    { value: "3", label: "退回资助中心（院级）" },
  ];
  return all.filter((o) => Number(o.value) < currentLevel);
}

// 评审动作标签。
export function reviewActionLabel(action: string): string {
  if (action === "pass") return "通过";
  if (action === "reject") return "退回";
  return action;
}

// 退回目标级别标签（用于流转日志）。
export function rejectTargetLabel(level: number): string {
  switch (level) {
    case 0:
      return "学生";
    case 1:
      return "班级";
    case 2:
      return "教学系";
    case 3:
      return "院级";
    default:
      return "—";
  }
}
