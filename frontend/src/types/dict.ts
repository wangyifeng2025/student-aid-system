// 数据字典类型（与 backend/internal/dto/dict.go 对齐）

export interface DictItem {
  id: number;
  type: string;
  code: string;
  label: string;
  sort: number;
}

export interface DictCreateInput {
  code: string;
  label: string;
  sort: number;
}

export interface DictUpdateInput {
  label: string;
  sort: number;
}

// 预置字典类型的中文名（来源 API.md / seed），用于下拉展示。
export const DICT_TYPE_LABELS: Record<string, string> = {
  household_type: "户口类型",
  difficulty_level: "困难等级",
  health_status: "健康状况",
  occupation: "职业",
  relation: "与学生关系",
  income_source: "收入来源",
  political_status: "政治面貌",
  nation: "民族",
  special_group_type: "特殊群体类型",
};

export function dictTypeLabel(type: string): string {
  return DICT_TYPE_LABELS[type] ?? type;
}
