package dto

import (
	"strings"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

// ===== 助学金家庭成员 =====

type GrantFamilyMemberInput struct {
	Name     string `json:"name"`
	Age      int    `json:"age"`
	Relation string `json:"relation"`
	WorkUnit string `json:"work_unit"`
}

type GrantFamilyMemberResponse struct {
	ID       uint   `json:"id"`
	Name     string `json:"name"`
	Age      int    `json:"age"`
	Relation string `json:"relation"`
	WorkUnit string `json:"work_unit"`
}

// ===== 助学金申请 =====

// CreateGrantRequest 基于认定结果发起助学金申请。
type CreateGrantRequest struct {
	RecognitionID uint   `json:"recognition_id" binding:"required"`
	GrantType     string `json:"grant_type"` // 默认 national_aid
}

// GrantRequest 助学金申请创建/修改请求。
type GrantRequest struct {
	Year                   int                      `json:"year" binding:"required"`
	Phone                  string                   `json:"phone"`
	HouseholdType          string                   `json:"household_type"`
	FamilyPopulation       int                      `json:"family_population"`
	MonthlyIncome          float64                  `json:"monthly_income"`
	PerCapitaMonthlyIncome float64                  `json:"per_capita_monthly_income"`
	IncomeSource           string                   `json:"income_source"`
	Address                string                   `json:"address"`
	PostalCode             string                   `json:"postal_code"`
	Reason                 string                   `json:"reason"`
	FamilyMembers          []GrantFamilyMemberInput `json:"family_members"`
}

// GrantListItem 助学金列表项。
type GrantListItem struct {
	ID          uint   `json:"id"`
	StudentID   uint   `json:"student_id"`
	StudentNo   string `json:"student_no"`
	StudentName string `json:"student_name"`
	DeptName    string `json:"dept_name"`
	MajorName   string `json:"major_name"`
	ClassName   string `json:"class_name"`
	Year        int    `json:"year"`
	GrantType   string `json:"grant_type"`
	Status      string `json:"status"`
	CurrentLevel int   `json:"current_level"`
}

// GrantResponse 助学金申请详情。
type GrantResponse struct {
	ID            uint   `json:"id"`
	StudentID     uint   `json:"student_id"`
	StudentNo     string `json:"student_no"`
	StudentName   string `json:"student_name"`
	RecognitionID uint   `json:"recognition_id"`
	GrantType     string `json:"grant_type"`
	Year          int    `json:"year"`
	Status        string `json:"status"`
	CurrentLevel  int    `json:"current_level"`
	RejectReason  string `json:"reject_reason"`

	// 本人情况（学籍只读展示）
	Gender          string `json:"gender"`
	Birth           string `json:"birth"`
	Nation          string `json:"nation"`
	PoliticalStatus string `json:"political_status"`
	EnrollTime      string `json:"enroll_time"`
	IDCard          string `json:"id_card"`
	GradeName       string `json:"grade_name"`
	SchoolUnit      string `json:"school_unit"`

	Phone                  string `json:"phone"`
	HouseholdType          string `json:"household_type"`
	FamilyPopulation       int    `json:"family_population"`
	MonthlyIncome          float64 `json:"monthly_income"`
	PerCapitaMonthlyIncome float64 `json:"per_capita_monthly_income"`
	IncomeSource           string `json:"income_source"`
	Address                string `json:"address"`
	PostalCode             string `json:"postal_code"`
	Reason                 string `json:"reason"`

	FamilyMembers []GrantFamilyMemberResponse `json:"family_members"`
	Reviews       []ReviewRecordResponse      `json:"reviews"`
}

func ToGrantFamilyMemberResponses(members []model.GrantFamilyMember) []GrantFamilyMemberResponse {
	out := make([]GrantFamilyMemberResponse, 0, len(members))
	for i := range members {
		m := &members[i]
		out = append(out, GrantFamilyMemberResponse{
			ID: m.ID, Name: m.Name, Age: m.Age, Relation: m.Relation, WorkUnit: m.WorkUnit,
		})
	}
	return out
}

func ToGrantResponse(
	a *model.GrantApplication,
	stu *model.Student,
	schoolUnit, gradeName string,
) GrantResponse {
	resp := GrantResponse{
		ID: a.ID, StudentID: a.StudentID, RecognitionID: a.RecognitionID,
		GrantType: string(a.GrantType), Year: a.Year,
		Status: string(a.Status), CurrentLevel: int(a.CurrentLevel), RejectReason: a.RejectReason,
		Phone: a.Phone, HouseholdType: string(a.HouseholdType),
		FamilyPopulation: a.FamilyPopulation, MonthlyIncome: a.MonthlyIncome,
		PerCapitaMonthlyIncome: a.PerCapitaMonthlyIncome, IncomeSource: a.IncomeSource,
		Address: a.Address, PostalCode: a.PostalCode, Reason: a.Reason,
		SchoolUnit: schoolUnit, GradeName: gradeName,
		FamilyMembers: ToGrantFamilyMemberResponses(a.FamilyMembers),
	}
	if stu != nil {
		resp.StudentNo = stu.StudentNo
		resp.StudentName = stu.Name
		resp.Gender = stu.Gender
		resp.Nation = stu.Nation
		resp.PoliticalStatus = stu.PoliticalStatus
		resp.IDCard = stu.IDCard
		if stu.Birth != nil {
			resp.Birth = stu.Birth.Format("2006.01")
		}
		if stu.EnrollTime != nil {
			resp.EnrollTime = stu.EnrollTime.Format("2006.01")
		}
	}
	return resp
}

func ApplyGrant(a *model.GrantApplication, req *GrantRequest) {
	a.Year = req.Year
	a.Phone = strings.TrimSpace(req.Phone)
	a.HouseholdType = model.HouseholdType(req.HouseholdType)
	a.FamilyPopulation = req.FamilyPopulation
	a.MonthlyIncome = req.MonthlyIncome
	a.PerCapitaMonthlyIncome = req.PerCapitaMonthlyIncome
	a.IncomeSource = strings.TrimSpace(req.IncomeSource)
	a.Address = strings.TrimSpace(req.Address)
	a.PostalCode = strings.TrimSpace(req.PostalCode)
	a.Reason = strings.TrimSpace(req.Reason)
}

func BuildGrantMembers(inputs []GrantFamilyMemberInput) []model.GrantFamilyMember {
	out := make([]model.GrantFamilyMember, 0, len(inputs))
	for _, in := range inputs {
		out = append(out, model.GrantFamilyMember{
			Name: strings.TrimSpace(in.Name), Age: in.Age,
			Relation: strings.TrimSpace(in.Relation), WorkUnit: strings.TrimSpace(in.WorkUnit),
		})
	}
	return out
}

func FormatDatePtr(t *time.Time, layout string) string {
	if t == nil {
		return ""
	}
	return t.Format(layout)
}
