package service

import (
	"fmt"
	"os"
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

// 家庭成员最大行数（模板中预留 6 行 {M1_*} ~ {M6_*}）。
const familyMemberMaxRows = 6

// recognitionTemplatePath 解析认定申请表 docx 模板路径。
func recognitionTemplatePath(cfg *config.Config) string {
	if cfg != nil && strings.TrimSpace(cfg.Export.RecognitionTemplatePath) != "" {
		return strings.TrimSpace(cfg.Export.RecognitionTemplatePath)
	}
	return "./assets/templates/recognition_application.docx"
}

// buildRecognitionDocxReplacements 构造认定申请表 docx 模板的占位符替换表。
//
// 模板含 {M1_*} ~ {M6_*} 共 6 行家庭成员占位符；实际成员不足 6 个时，
// 剩余占位符填一个全角空格（保持表格单元格不为空，避免 Word 自动删行）。
func buildRecognitionDocxReplacements(
	cfg *config.Config,
	a *model.RecognitionApplication,
	stu *model.Student,
	dept, major, grade, class string,
	labels labelMaps,
) map[string]string {
	data := buildRecognitionFormData(cfg, a, stu, dept, major, grade, class, labels)

	repl := map[string]string{
		"school":         data.School,
		"dept":           data.Dept,
		"major":          data.Major,
		"grade":          data.Grade,
		"class":          data.Class,
		"student_name":   data.StudentName,
		"gender":         data.Gender,
		"birth":          data.Birth,
		"native_place":   data.NativePlace,
		"id_card":        data.IDCard,
		"family_pop":     data.FamilyPop,
		"phone":          data.Phone,
		"address":        data.Address,
		"postal_code":    data.PostalCode,
		"guardian_phone": data.GuardianPhone,
		"special_groups": buildSpecialGroupsText(data),
		"per_capita":     data.PerCapita,
		"natural":        data.Natural,
		"sudden":         data.Sudden,
		"weak_labor":     data.WeakLabor,
		"unemployment":   data.Unemployment,
		"debt":           data.Debt,
		"other_info":     data.OtherInfo,
	}

	// 家庭成员 6 行：不足的填空格
	padded := make([]model.FamilyMember, familyMemberMaxRows)
	copy(padded, data.Members)
	for i := 0; i < familyMemberMaxRows; i++ {
		prefix := fmt.Sprintf("M%d", i+1)
		m := padded[i]
		income := ""
		if m.AnnualIncome > 0 {
			income = fmt.Sprintf("%.0f", m.AnnualIncome)
		}
		name := m.Name
		age := ageStr(m.Age)
		relation := labels.label("relation", m.Relation)
		work := m.WorkUnit
		occupation := labels.label("occupation", m.Occupation)
		health := labels.label("health_status", m.Health)
		// 空单元格用全角空格，避免 Word 把空单元格折叠
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
		if occupation == "" {
			occupation = " "
		}
		if income == "" {
			income = " "
		}
		if health == "" {
			health = " "
		}
		repl[prefix+"_NAME"] = name
		repl[prefix+"_AGE"] = age
		repl[prefix+"_RELATION"] = relation
		repl[prefix+"_WORK"] = work
		repl[prefix+"_OCCUPATION"] = occupation
		repl[prefix+"_INCOME"] = income
		repl[prefix+"_HEALTH"] = health
	}
	return repl
}

func buildSpecialGroupsText(d recognitionFormData) string {
	var parts []string
	for _, item := range specialGroupFormLabels {
		parts = append(parts, specialGroupCheckbox(item.name, d.SpecialSet[string(item.code)]))
	}
	return strings.Join(parts, "；") + "。"
}

// exportRecognitionDocx 读模板 → 归一化占位符 → 填数 → 返回 docx 字节。
func exportRecognitionDocx(cfg *config.Config, replacements map[string]string) ([]byte, error) {
	templatePath := recognitionTemplatePath(cfg)
	templateBytes, err := os.ReadFile(templatePath)
	if err != nil {
		return nil, NewValidationError(fmt.Sprintf("读取认定表 Word 模板失败（%s），请联系管理员", templatePath))
	}
	return fillDocxTemplate(templateBytes, replacements)
}
