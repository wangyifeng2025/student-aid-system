package dto

import "github.com/wangyifeng2025/student-aid-system/internal/model"

// ===== 院系 Department =====

// DepartmentRequest 院系创建/修改请求。
type DepartmentRequest struct {
	Name string `json:"name" binding:"required"`
	Code string `json:"code"`
}

// DepartmentResponse 院系响应。
type DepartmentResponse struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
}

// ===== 专业 Major =====

// MajorRequest 专业创建/修改请求。
type MajorRequest struct {
	DeptID uint   `json:"dept_id" binding:"required"`
	Name   string `json:"name" binding:"required"`
	Code   string `json:"code"`
}

// MajorResponse 专业响应。
type MajorResponse struct {
	ID     uint   `json:"id"`
	DeptID uint   `json:"dept_id"`
	Name   string `json:"name"`
	Code   string `json:"code"`
}

// ===== 年级 Grade =====

// GradeRequest 年级创建/修改请求。
type GradeRequest struct {
	Name string `json:"name" binding:"required"`
	Year int    `json:"year" binding:"required"`
}

// GradeResponse 年级响应。
type GradeResponse struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
	Year int    `json:"year"`
}

// ===== 班级 Class =====

// ClassRequest 班级创建/修改请求。
type ClassRequest struct {
	DeptID    uint   `json:"dept_id" binding:"required"`
	MajorID   uint   `json:"major_id"`
	GradeID   uint   `json:"grade_id"`
	Name      string `json:"name" binding:"required"`
	AdvisorID *uint  `json:"advisor_id"`
}

// ClassResponse 班级响应。
type ClassResponse struct {
	ID        uint   `json:"id"`
	DeptID    uint   `json:"dept_id"`
	MajorID   uint   `json:"major_id"`
	GradeID   uint   `json:"grade_id"`
	Name      string `json:"name"`
	AdvisorID *uint  `json:"advisor_id"`
}

// ===== 转换器 =====

func ToDepartmentResponse(d *model.Department) DepartmentResponse {
	return DepartmentResponse{ID: d.ID, Name: d.Name, Code: d.Code}
}

func ToDepartmentResponses(items []model.Department) []DepartmentResponse {
	out := make([]DepartmentResponse, 0, len(items))
	for i := range items {
		out = append(out, ToDepartmentResponse(&items[i]))
	}
	return out
}

func ToMajorResponse(m *model.Major) MajorResponse {
	return MajorResponse{ID: m.ID, DeptID: m.DeptID, Name: m.Name, Code: m.Code}
}

func ToMajorResponses(items []model.Major) []MajorResponse {
	out := make([]MajorResponse, 0, len(items))
	for i := range items {
		out = append(out, ToMajorResponse(&items[i]))
	}
	return out
}

func ToGradeResponse(g *model.Grade) GradeResponse {
	return GradeResponse{ID: g.ID, Name: g.Name, Year: g.Year}
}

func ToGradeResponses(items []model.Grade) []GradeResponse {
	out := make([]GradeResponse, 0, len(items))
	for i := range items {
		out = append(out, ToGradeResponse(&items[i]))
	}
	return out
}

func ToClassResponse(c *model.Class) ClassResponse {
	return ClassResponse{
		ID:        c.ID,
		DeptID:    c.DeptID,
		MajorID:   c.MajorID,
		GradeID:   c.GradeID,
		Name:      c.Name,
		AdvisorID: c.AdvisorID,
	}
}

func ToClassResponses(items []model.Class) []ClassResponse {
	out := make([]ClassResponse, 0, len(items))
	for i := range items {
		out = append(out, ToClassResponse(&items[i]))
	}
	return out
}
