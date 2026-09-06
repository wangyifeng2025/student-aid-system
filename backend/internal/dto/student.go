package dto

import (
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

// DateLayout 业务日期统一格式（仅日期）。
const DateLayout = "2006-01-02"

// PageResult 通用分页结果。
type PageResult[T any] struct {
	Items    []T   `json:"items"`
	Total    int64 `json:"total"`
	Page     int   `json:"page"`
	PageSize int   `json:"page_size"`
}

// ===== 学生 Student =====

// StudentRequest 学生创建/修改请求。日期字段用 YYYY-MM-DD 字符串。
// 学号、身份证号、性别、dept_id/major_id/class_id 为必填（由 service 校验）；学号与身份证号均须全局唯一。
type StudentRequest struct {
	StudentNo       string `json:"student_no" binding:"required"`
	Name            string `json:"name" binding:"required"`
	Gender          string `json:"gender" binding:"required"`
	Birth           string `json:"birth"`
	Nation          string `json:"nation"`
	PoliticalStatus string `json:"political_status"`
	IDCard          string `json:"id_card" binding:"required"`
	Phone           string `json:"phone"`
	EnrollTime      string `json:"enroll_time"`
	DeptID          uint   `json:"dept_id"`
	MajorID         uint   `json:"major_id"`
	ClassID         uint   `json:"class_id"`
}

// StudentResponse 学生响应。
type StudentResponse struct {
	ID              uint   `json:"id"`
	UserID          uint   `json:"user_id"`
	StudentNo       string `json:"student_no"`
	Name            string `json:"name"`
	Gender          string `json:"gender"`
	Birth           string `json:"birth"`
	Nation          string `json:"nation"`
	PoliticalStatus string `json:"political_status"`
	IDCard          string `json:"id_card"`
	Phone           string `json:"phone"`
	EnrollTime      string `json:"enroll_time"`
	DeptID          uint   `json:"dept_id"`
	MajorID         uint   `json:"major_id"`
	ClassID         uint   `json:"class_id"`
	DeptName        string `json:"dept_name"`
	ClassName       string `json:"class_name"`
	IsKeyGroup      bool   `json:"is_key_group"`
	// InitialPassword 仅在新建学生时返回，用于提示管理员初始密码；其余场景为空。
	InitialPassword string `json:"initial_password,omitempty"`

	// 指定学年的申报进度（列表/详情按 year 查询参数，默认当年）。
	ProgressYear       int    `json:"progress_year"`
	RecognitionStatus  string `json:"recognition_status"`
	RecognitionID      uint   `json:"recognition_id,omitempty"`
	DifficultyLevel    string `json:"difficulty_level,omitempty"`
	GrantStatus        string `json:"grant_status"`
	GrantID            uint   `json:"grant_id,omitempty"`
}

func fmtDate(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format(DateLayout)
}

func ToStudentResponse(s *model.Student) StudentResponse {
	var userID uint
	if s.UserID != nil {
		userID = *s.UserID
	}
	return StudentResponse{
		ID:              s.ID,
		UserID:          userID,
		StudentNo:       s.StudentNo,
		Name:            s.Name,
		Gender:          s.Gender,
		Birth:           fmtDate(s.Birth),
		Nation:          s.Nation,
		PoliticalStatus: s.PoliticalStatus,
		IDCard:          s.IDCard,
		Phone:           s.Phone,
		EnrollTime:      fmtDate(s.EnrollTime),
		DeptID:          s.DeptID,
		MajorID:         s.MajorID,
		ClassID:         s.ClassID,
		IsKeyGroup:      s.IsKeyGroup,
	}
}

func ToStudentResponses(items []model.Student) []StudentResponse {
	out := make([]StudentResponse, 0, len(items))
	for i := range items {
		out = append(out, ToStudentResponse(&items[i]))
	}
	return out
}

// ===== 重点人群 SpecialGroup =====

// SpecialGroupRequest 重点保障人群名单创建/修改请求。
type SpecialGroupRequest struct {
	StudentNo string `json:"student_no"`
	IDCard    string `json:"id_card"`
	Name      string `json:"name"`
	Type      string `json:"type" binding:"required"`
	Source    string `json:"source"`
	Batch     string `json:"batch"`
	Year      int    `json:"year"`
}

// SpecialGroupResponse 重点人群响应。
type SpecialGroupResponse struct {
	ID        uint   `json:"id"`
	StudentNo string `json:"student_no"`
	IDCard    string `json:"id_card"`
	Name      string `json:"name"`
	Type      string `json:"type"`
	Source    string `json:"source"`
	Batch     string `json:"batch"`
	Year      int    `json:"year"`
}

func ToSpecialGroupResponse(s *model.SpecialGroup) SpecialGroupResponse {
	return SpecialGroupResponse{
		ID:        s.ID,
		StudentNo: s.StudentNo,
		IDCard:    s.IDCard,
		Name:      s.Name,
		Type:      string(s.Type),
		Source:    s.Source,
		Batch:     s.Batch,
		Year:      s.Year,
	}
}

func ToSpecialGroupResponses(items []model.SpecialGroup) []SpecialGroupResponse {
	out := make([]SpecialGroupResponse, 0, len(items))
	for i := range items {
		out = append(out, ToSpecialGroupResponse(&items[i]))
	}
	return out
}

// ===== Excel 导入 =====

// ImportRowError 导入时单行的错误（定位到行/列）。
type ImportRowError struct {
	Row     int    `json:"row"`    // Excel 行号（含表头，从 1 计）
	Column  string `json:"column"` // 列名（中文表头）
	Message string `json:"message"`
}

// ImportResult 导入结果汇总与错误回显。
type ImportResult struct {
	Total   int              `json:"total"`   // 数据行总数（不含表头）
	Success int              `json:"success"` // 成功导入行数
	Failed  int              `json:"failed"`  // 失败行数
	Errors  []ImportRowError `json:"errors"`
}

// Fail 记录一行导入失败。
func (r *ImportResult) Fail(e ImportRowError) {
	r.Failed++
	r.Errors = append(r.Errors, e)
}
