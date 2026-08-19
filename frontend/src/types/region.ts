// 行政区划代码（与 backend/internal/dto/region_code.go 对齐）

export interface RegionCode {
  id: number;
  code: string;
  name: string;
  level: number;
  type: string;
  parent_code: string;
  id_prefix: string;
  sort: number;
  child_count: number;
}

export interface RegionCodeInput {
  code: string;
  name: string;
  level: number;
  type: string;
  parent_code?: string;
  sort?: number;
}

export interface RegionCodeUpdateInput {
  name: string;
  level: number;
  type: string;
  parent_code?: string;
  sort?: number;
}

export interface RegionBrief {
  code: string;
  name: string;
  type: string;
  level: number;
}

export interface RegionLookup {
  id_prefix: string;
  matched_code: string;
  matched_name: string;
  matched_level: number;
  province: RegionBrief | null;
  city: RegionBrief | null;
  district: RegionBrief | null;
  full_name: string;
}

export interface RegionImportResult {
  created: number;
  updated: number;
  skipped: number;
}

export const REGION_LEVEL_LABEL: Record<number, string> = {
  1: "省级",
  2: "地市",
  3: "区县",
};
