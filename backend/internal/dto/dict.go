package dto

import "github.com/wangyifeng2025/student-aid-system/internal/model"

// DictCreateRequest 新增字典项（type 取自路径）。
type DictCreateRequest struct {
	Code  string `json:"code" binding:"required"`
	Label string `json:"label" binding:"required"`
	Sort  int    `json:"sort"`
}

// DictUpdateRequest 修改字典项；type+code 为标识，不可改，仅可改显示文案与排序。
type DictUpdateRequest struct {
	Label string `json:"label" binding:"required"`
	Sort  int    `json:"sort"`
}

// DictResponse 字典项响应。
type DictResponse struct {
	ID    uint   `json:"id"`
	Type  string `json:"type"`
	Code  string `json:"code"`
	Label string `json:"label"`
	Sort  int    `json:"sort"`
}

func ToDictResponse(d *model.Dict) DictResponse {
	return DictResponse{ID: d.ID, Type: d.Type, Code: d.Code, Label: d.Label, Sort: d.Sort}
}

func ToDictResponses(items []model.Dict) []DictResponse {
	out := make([]DictResponse, 0, len(items))
	for i := range items {
		out = append(out, ToDictResponse(&items[i]))
	}
	return out
}
