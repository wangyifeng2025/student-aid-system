package service

import (
	"fmt"
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
)

// recognitionFormSchool 表头「学校」默认值（可在 export.school_name 覆盖）。
const recognitionFormSchool = "黔西南民族职业技术学院"

// specialGroupFormLabels 与《家庭经济困难学生认定申请表（2024年）》勾选顺序一致。
var specialGroupFormLabels = []struct {
	code model.SpecialGroupType
	name string
}{
	{model.SGPoverty, "脱贫家庭学生"},
	{model.SGPovertyUnstable, "脱贫不稳定家庭学生"},
	{model.SGMarginal, "边缘易致贫家庭学生"},
	{model.SGSuddenDifficulty, "突发严重困难家庭学生"},
	{model.SGLowIncome, "低保家庭学生"},
	{model.SGLowIncomeMargin, "低保边缘家庭学生"},
	{model.SGExtremePoverty, "特困救助供养学生"},
	{model.SGRigidExpenditure, "刚性支出困难家庭学生"},
	{model.SGOtherLowIncome, "其他低收入学生"},
	{model.SGOrphan, "孤儿"},
	{model.SGNoGuardian, "事实无人抚养儿童"},
	{model.SGDisabledStudent, "残疾学生"},
	{model.SGDisabledParent, "残疾人子女"},
	{model.SGMartyrChild, "烈士子女"},
}

type recognitionFormData struct {
	School        string
	Dept          string
	Major         string
	Grade         string
	Class         string
	StudentName   string
	Gender        string
	Birth         string
	NativePlace   string
	IDCard        string
	FamilyPop     string
	Phone         string
	Address       string
	PostalCode    string
	GuardianPhone string
	Members       []model.FamilyMember
	SpecialSet    map[string]bool
	PerCapita     string
	Natural       string
	Sudden        string
	WeakLabor     string
	Unemployment  string
	Debt          string
	OtherInfo     string
	Labels        labelMaps
}

func schoolNameForExport(cfg *config.Config) string {
	if cfg != nil && strings.TrimSpace(cfg.Export.SchoolName) != "" {
		return strings.TrimSpace(cfg.Export.SchoolName)
	}
	return recognitionFormSchool
}

func buildRecognitionFormData(
	cfg *config.Config,
	a *model.RecognitionApplication,
	stu *model.Student,
	dept, major, grade, class string,
	labels labelMaps,
) recognitionFormData {
	specialSet := map[string]bool{}
	for _, p := range strings.Split(a.SpecialTypes, ",") {
		p = strings.TrimSpace(p)
		if p != "" {
			specialSet[p] = true
		}
	}
	d := recognitionFormData{
		School:        schoolNameForExport(cfg),
		Dept:          dept,
		Major:         major,
		Grade:         grade,
		Class:         class,
		NativePlace:   a.NativePlace,
		IDCard:        a.IDCard,
		FamilyPop:     fmt.Sprintf("%d人", a.FamilyPopulation),
		Phone:         a.Phone,
		Address:       a.Address,
		PostalCode:    a.PostalCode,
		GuardianPhone: a.GuardianPhone,
		Members:       a.FamilyMembers,
		SpecialSet:    specialSet,
		PerCapita:     fmt.Sprintf("%.0f", a.PerCapitaAnnualIncome),
		Natural:       orNone(a.NaturalDisaster),
		Sudden:        orNone(a.SuddenAccident),
		WeakLabor:     orNone(a.WeakLabor),
		Unemployment:  orNone(a.Unemployment),
		Debt:          orNone(a.Debt),
		OtherInfo:     orNone(a.OtherInfo),
		Labels:        labels,
	}
	if stu != nil {
		d.StudentName = stu.Name
		d.Gender = genderLabel(stu.Gender)
		if stu.Birth != nil {
			d.Birth = stu.Birth.Format("2006年01月")
		}
		if d.IDCard == "" {
			d.IDCard = stu.IDCard
		}
	}
	return d
}

func specialGroupCheckbox(name string, yes bool) string {
	if yes {
		return name + "：☑是 □否"
	}
	return name + "：□是 ☑否"
}

func ageStr(age int) string {
	if age <= 0 {
		return ""
	}
	return fmt.Sprintf("%d", age)
}

func resolveStudentOrgNames(orgRepo *repository.OrgRepository, stu *model.Student) (dept, major, grade, class string) {
	if stu == nil {
		return
	}
	if d, err := orgRepo.FindDepartment(stu.DeptID); err == nil {
		dept = d.Name
	}
	if m, err := orgRepo.FindMajor(stu.MajorID); err == nil {
		major = m.Name
	}
	if c, err := orgRepo.FindClass(stu.ClassID); err == nil {
		class = c.Name
		if g, gErr := orgRepo.FindGrade(c.GradeID); gErr == nil {
			grade = g.Name
		}
	}
	return dept, major, grade, class
}
