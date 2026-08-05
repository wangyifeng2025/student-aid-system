package service

import (
	"fmt"
	"os"
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

// 助学金模板家庭成员最大行数（模板预留 M1~M9 共 9 行）。
const grantFamilyMemberMaxRows = 9

func grantTemplatePath(cfg *config.Config) string {
	if cfg != nil && strings.TrimSpace(cfg.Export.GrantTemplatePath) != "" {
		return strings.TrimSpace(cfg.Export.GrantTemplatePath)
	}
	return "./assets/templates/grant_national_aid.docx"
}

func buildGrantDocxReplacements(
	cfg *config.Config,
	a *model.GrantApplication,
	stu *model.Student,
	schoolUnit, gradeName string,
	labels labelMaps,
) map[string]string {
	repl := map[string]string{
		"student_name":       studentName(stu),
		"gender":             genderLabel(studentGender(stu)),
		"birth":              studentBirth(stu),
		"nation":             labels.label("nation", studentNation(stu)),
		"political_status":   labels.label("political_status", studentPolitical(stu)),
		"enroll_time":        studentEnroll(stu),
		"student_no":         studentNo(stu),
		"grade":              gradeName,
		"id_card":            studentIDCard(stu),
		"phone":              a.Phone,
		"school_unit":        grantSchoolUnitText(cfg, schoolUnit),
		"household":          grantHouseholdCheckbox(a.HouseholdType),
		"family_pop":         fmt.Sprintf("%d人", a.FamilyPopulation),
		"monthly_income":     fmt.Sprintf("%.0f元", a.MonthlyIncome),
		"per_capita_income":  fmt.Sprintf("%.0f元", a.PerCapitaMonthlyIncome),
		"income_source":      labels.label("income_source", a.IncomeSource),
		"address":            a.Address,
		"postal_code":        a.PostalCode,
		"reason":             orNone(a.Reason),
		"dept_opinion":       grantReviewOpinion(a.Reviews, model.LevelDepartment),
		"college_opinion":    grantReviewOpinion(a.Reviews, model.LevelCollege),
	}

	padded := make([]model.GrantFamilyMember, grantFamilyMemberMaxRows)
	copy(padded, a.FamilyMembers)
	for i := 0; i < grantFamilyMemberMaxRows; i++ {
		prefix := fmt.Sprintf("M%d", i+1)
		m := padded[i]
		name := m.Name
		age := ageStr(m.Age)
		relation := labels.label("relation", m.Relation)
		work := m.WorkUnit
		if name == "" {
			name = " "
		}
		if age == "" {
			age = " "
		}
		if relation == "" {
			relation = " "
		}
		if work == "" {
			work = " "
		}
		repl[prefix+"_NAME"] = name
		repl[prefix+"_AGE"] = age
		repl[prefix+"_RELATION"] = relation
		repl[prefix+"_WORK"] = work
	}
	return repl
}

func exportGrantDocx(cfg *config.Config, replacements map[string]string) ([]byte, error) {
	templatePath := grantTemplatePath(cfg)
	templateBytes, err := os.ReadFile(templatePath)
	if err != nil {
		return nil, NewValidationError(fmt.Sprintf("读取助学金 Word 模板失败（%s），请联系管理员", templatePath))
	}
	return fillDocxTemplate(templateBytes, replacements)
}

func grantSchoolUnitText(cfg *config.Config, schoolUnit string) string {
	school := strings.TrimSpace(cfg.Export.SchoolName)
	if school == "" {
		return schoolUnit
	}
	if strings.HasPrefix(schoolUnit, school) {
		return schoolUnit
	}
	return school + schoolUnit
}

func grantHouseholdCheckbox(t model.HouseholdType) string {
	switch t {
	case model.HouseholdUrban:
		return "☑城镇      □农村"
	case model.HouseholdRural:
		return "□城镇      ☑农村"
	default:
		return "□城镇      □农村"
	}
}

func studentName(stu *model.Student) string {
	if stu == nil {
		return ""
	}
	return stu.Name
}

func studentGender(stu *model.Student) string {
	if stu == nil {
		return ""
	}
	return stu.Gender
}

func studentNation(stu *model.Student) string {
	if stu == nil {
		return ""
	}
	return stu.Nation
}

func studentPolitical(stu *model.Student) string {
	if stu == nil {
		return ""
	}
	return stu.PoliticalStatus
}

func studentNo(stu *model.Student) string {
	if stu == nil {
		return ""
	}
	return stu.StudentNo
}

func studentIDCard(stu *model.Student) string {
	if stu == nil {
		return ""
	}
	return stu.IDCard
}

func studentBirth(stu *model.Student) string {
	if stu == nil || stu.Birth == nil {
		return ""
	}
	return stu.Birth.Format("2006.01")
}

func studentEnroll(stu *model.Student) string {
	if stu == nil || stu.EnrollTime == nil {
		return ""
	}
	return stu.EnrollTime.Format("2006.01")
}
