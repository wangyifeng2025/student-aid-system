package dto

import (
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

// ===== 家庭成员 =====

// FamilyMemberInput 家庭成员录入项。
type FamilyMemberInput struct {
	Name         string  `json:"name"`
	Age          int     `json:"age"`
	Relation     string  `json:"relation"`   // 字典 relation
	WorkUnit     string  `json:"work_unit"`  // 工作/学习单位
	Occupation   string  `json:"occupation"` // 字典 occupation
	AnnualIncome float64 `json:"annual_income"`
	Health       string  `json:"health"`       // 字典 health_status
	SpecialType  string  `json:"special_type"` // 特殊群体类型（可空）
}

// FamilyMemberResponse 家庭成员响应。
type FamilyMemberResponse struct {
	ID           uint    `json:"id"`
	Name         string  `json:"name"`
	Age          int     `json:"age"`
	Relation     string  `json:"relation"`
	WorkUnit     string  `json:"work_unit"`
	Occupation   string  `json:"occupation"`
	AnnualIncome float64 `json:"annual_income"`
	Health       string  `json:"health"`
	SpecialType  string  `json:"special_type"`
}

// ===== 认定申请 =====

// RecognitionRequest 认定申请创建/修改请求（草稿与提交共用，提交时做完整校验）。
type RecognitionRequest struct {
	Year int `json:"year" binding:"required"`

	// 基本情况
	Nation           string `json:"nation"`
	NativePlace      string `json:"native_place"`
	IDCard           string `json:"id_card"`
	FamilyPopulation int    `json:"family_population"`
	Phone            string `json:"phone"`
	Address          string `json:"address"`
	PostalCode       string `json:"postal_code"`
	GuardianPhone    string `json:"guardian_phone"`

	// 家庭经济情况
	HouseholdType         string  `json:"household_type"`
	PerCapitaAnnualIncome float64 `json:"per_capita_annual_income"`
	IncomeSource          string  `json:"income_source"`

	// 特殊群体勾选
	SpecialTypes []string `json:"special_types"`

	// 影响家庭经济状况信息
	NaturalDisaster string `json:"natural_disaster"`
	SuddenAccident  string `json:"sudden_accident"`
	WeakLabor       string `json:"weak_labor"`
	Unemployment    string `json:"unemployment"`
	Debt            string `json:"debt"`
	OtherInfo       string `json:"other_info"`

	// 个人承诺
	CommitmentAgreed bool `json:"commitment_agreed"`

	FamilyMembers []FamilyMemberInput `json:"family_members"`
}

// RecognitionResponse 认定申请详情响应。
type RecognitionResponse struct {
	ID          uint   `json:"id"`
	StudentID   uint   `json:"student_id"`
	StudentNo   string `json:"student_no"`
	StudentName string `json:"student_name"`
	DeptName    string `json:"dept_name"`
	ClassName   string `json:"class_name"`
	Year        int    `json:"year"`

	Nation           string `json:"nation"`
	NativePlace      string `json:"native_place"`
	IDCard           string `json:"id_card"`
	FamilyPopulation int    `json:"family_population"`
	Phone            string `json:"phone"`
	Address          string `json:"address"`
	PostalCode       string `json:"postal_code"`
	GuardianPhone    string `json:"guardian_phone"`

	HouseholdType         string  `json:"household_type"`
	PerCapitaAnnualIncome float64 `json:"per_capita_annual_income"`
	IncomeSource          string  `json:"income_source"`

	SpecialTypes []string `json:"special_types"`

	NaturalDisaster string `json:"natural_disaster"`
	SuddenAccident  string `json:"sudden_accident"`
	WeakLabor       string `json:"weak_labor"`
	Unemployment    string `json:"unemployment"`
	Debt            string `json:"debt"`
	OtherInfo       string `json:"other_info"`

	CommitmentAgreed bool `json:"commitment_agreed"`

	Status          string `json:"status"`
	CurrentLevel    int    `json:"current_level"`
	DifficultyLevel string `json:"difficulty_level"`
	RejectReason    string `json:"reject_reason"`

	FamilyMembers []FamilyMemberResponse `json:"family_members"`
	Reviews       []ReviewRecordResponse `json:"reviews"`
}

// RecognitionListItem 认定申请列表项（精简）。
type RecognitionListItem struct {
	ID                    uint    `json:"id"`
	StudentID             uint    `json:"student_id"`
	StudentNo             string  `json:"student_no"`
	StudentName           string  `json:"student_name"`
	DeptName              string  `json:"dept_name"`
	MajorName             string  `json:"major_name"`
	ClassName             string  `json:"class_name"`
	Year                  int     `json:"year"`
	Status                string  `json:"status"`
	CurrentLevel          int     `json:"current_level"`
	DifficultyLevel       string  `json:"difficulty_level"`
	PerCapitaAnnualIncome float64 `json:"per_capita_annual_income"`
}

// SubmitResult 提交评审结果：申请快照 + 非阻断性提示（单亲/单薪等）。
type SubmitResult struct {
	Application *RecognitionResponse `json:"application"`
	Warnings    []string             `json:"warnings"`
}

// SplitSpecialTypes 将逗号分隔的特殊群体集合拆为切片（去空）。
func SplitSpecialTypes(s string) []string {
	if strings.TrimSpace(s) == "" {
		return []string{}
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// JoinSpecialTypes 将切片拼为逗号分隔字符串（去空去重）。
func JoinSpecialTypes(types []string) string {
	seen := make(map[string]struct{}, len(types))
	out := make([]string, 0, len(types))
	for _, t := range types {
		t = strings.TrimSpace(t)
		if t == "" {
			continue
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	return strings.Join(out, ",")
}

func ToFamilyMemberResponses(items []model.FamilyMember) []FamilyMemberResponse {
	out := make([]FamilyMemberResponse, 0, len(items))
	for i := range items {
		m := &items[i]
		out = append(out, FamilyMemberResponse{
			ID:           m.ID,
			Name:         m.Name,
			Age:          m.Age,
			Relation:     m.Relation,
			WorkUnit:     m.WorkUnit,
			Occupation:   m.Occupation,
			AnnualIncome: m.AnnualIncome,
			Health:       m.Health,
			SpecialType:  m.SpecialType,
		})
	}
	return out
}

// ToRecognitionResponse 组装详情响应；studentNo/studentName 由调用方传入（来自关联学生）。
func ToRecognitionResponse(a *model.RecognitionApplication, studentNo, studentName string) RecognitionResponse {
	return RecognitionResponse{
		ID:                    a.ID,
		StudentID:             a.StudentID,
		StudentNo:             studentNo,
		StudentName:           studentName,
		Year:                  a.Year,
		Nation:                a.Nation,
		NativePlace:           a.NativePlace,
		IDCard:                a.IDCard,
		FamilyPopulation:      a.FamilyPopulation,
		Phone:                 a.Phone,
		Address:               a.Address,
		PostalCode:            a.PostalCode,
		GuardianPhone:         a.GuardianPhone,
		HouseholdType:         string(a.HouseholdType),
		PerCapitaAnnualIncome: a.PerCapitaAnnualIncome,
		IncomeSource:          a.IncomeSource,
		SpecialTypes:          SplitSpecialTypes(a.SpecialTypes),
		NaturalDisaster:       a.NaturalDisaster,
		SuddenAccident:        a.SuddenAccident,
		WeakLabor:             a.WeakLabor,
		Unemployment:          a.Unemployment,
		Debt:                  a.Debt,
		OtherInfo:             a.OtherInfo,
		CommitmentAgreed:      a.CommitmentAgreed,
		Status:                string(a.Status),
		CurrentLevel:          int(a.CurrentLevel),
		DifficultyLevel:       string(a.DifficultyLevel),
		RejectReason:          a.RejectReason,
		FamilyMembers:         ToFamilyMemberResponses(a.FamilyMembers),
		Reviews:               []ReviewRecordResponse{},
	}
}

// ===== 附件 =====

// AttachmentResponse 附件响应。
type AttachmentResponse struct {
	ID         uint   `json:"id"`
	OwnerType  string `json:"owner_type"`
	OwnerID    uint   `json:"owner_id"`
	FileName   string `json:"file_name"`
	Size       int64  `json:"size"`
	Mime       string `json:"mime"`
	UploaderID uint   `json:"uploader_id"`
}

func ToAttachmentResponse(a *model.Attachment) AttachmentResponse {
	return AttachmentResponse{
		ID:         a.ID,
		OwnerType:  a.OwnerType,
		OwnerID:    a.OwnerID,
		FileName:   a.FileName,
		Size:       a.Size,
		Mime:       a.Mime,
		UploaderID: a.UploaderID,
	}
}

func ToAttachmentResponses(items []model.Attachment) []AttachmentResponse {
	out := make([]AttachmentResponse, 0, len(items))
	for i := range items {
		out = append(out, ToAttachmentResponse(&items[i]))
	}
	return out
}
