package dto

import "github.com/wangyifeng2025/student-aid-system/internal/model"

// RegionCodeRequest 新增行政区划。
type RegionCodeRequest struct {
	Code       string `json:"code" binding:"required"`
	Name       string `json:"name" binding:"required"`
	Level      int    `json:"level" binding:"required"`
	Type       string `json:"type"`
	ParentCode string `json:"parent_code"`
	Sort       int    `json:"sort"`
}

// RegionCodeUpdateRequest 修改行政区划（编码不可改）。
type RegionCodeUpdateRequest struct {
	Name       string `json:"name" binding:"required"`
	Level      int    `json:"level"`
	Type       string `json:"type"`
	ParentCode string `json:"parent_code"`
	Sort       int    `json:"sort"`
}

// RegionCodeResponse 行政区划列表/详情。
type RegionCodeResponse struct {
	ID         uint   `json:"id"`
	Code       string `json:"code"`
	Name       string `json:"name"`
	Level      int    `json:"level"`
	Type       string `json:"type"`
	ParentCode string `json:"parent_code"`
	IDPrefix   string `json:"id_prefix"`
	Sort       int    `json:"sort"`
	ChildCount int64  `json:"child_count"`
}

// RegionBrief 区划简要信息（用于身份证解析路径）。
type RegionBrief struct {
	Code  string `json:"code"`
	Name  string `json:"name"`
	Type  string `json:"type"`
	Level int    `json:"level"`
}

// RegionLookupResponse 按身份证或 6 位区划码解析出的地址。
type RegionLookupResponse struct {
	IDPrefix     string       `json:"id_prefix"`
	MatchedCode  string       `json:"matched_code"`
	MatchedName  string       `json:"matched_name"`
	MatchedLevel int          `json:"matched_level"`
	Province     *RegionBrief `json:"province"`
	City         *RegionBrief `json:"city"`
	District     *RegionBrief `json:"district"`
	FullName     string       `json:"full_name"`
}

// RegionImportResult 导入区划树的结果。
type RegionImportResult struct {
	Created int `json:"created"`
	Updated int `json:"updated"`
	Skipped int `json:"skipped"`
}

func ToRegionCodeResponse(r *model.RegionCode, childCount int64) RegionCodeResponse {
	return RegionCodeResponse{
		ID: r.ID, Code: r.Code, Name: r.Name, Level: r.Level, Type: r.Type,
		ParentCode: r.ParentCode, IDPrefix: r.IDPrefix, Sort: r.Sort, ChildCount: childCount,
	}
}

func ToRegionBrief(r *model.RegionCode) RegionBrief {
	return RegionBrief{Code: r.Code, Name: r.Name, Type: r.Type, Level: r.Level}
}
