package service

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/go-pdf/fpdf"
	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"gorm.io/gorm"
)

// GrantPDFService 国家助学金申请表 PDF 导出（审批通过后可导出）。
type GrantPDFService struct {
	cfg      *config.Config
	repo     *repository.GrantRepository
	stuRepo  *repository.StudentRepository
	orgRepo  *repository.OrgRepository
	dictRepo *repository.DictRepository
}

func NewGrantPDFService(db *gorm.DB, cfg *config.Config) *GrantPDFService {
	return &GrantPDFService{
		cfg:      cfg,
		repo:     repository.NewGrantRepository(db),
		stuRepo:  repository.NewStudentRepository(db),
		orgRepo:  repository.NewOrgRepository(db),
		dictRepo: repository.NewDictRepository(db),
	}
}

func (s *GrantPDFService) Export(actor rbac.Actor, id uint) ([]byte, string, error) {
	ok, err := s.repo.CanAccess(actor, id)
	if err != nil {
		return nil, "", err
	}
	if !ok {
		return nil, "", ErrNotFound
	}
	a, err := s.repo.FindByID(id)
	if repository.IsNotFound(err) {
		return nil, "", ErrNotFound
	}
	if err != nil {
		return nil, "", err
	}
	if a.Status != model.GrantStatusApproved {
		return nil, "", NewValidationError("仅审批通过的助学金申请可导出 PDF")
	}
	if strings.TrimSpace(s.cfg.Export.PDFFontPath) == "" {
		return nil, "", NewValidationError("服务端未配置中文字体（export.pdf_font_path），无法导出 PDF，请联系管理员")
	}

	stu, _ := s.stuRepo.FindStudent(a.StudentID)
	schoolUnit, gradeName := resolveGrantSchoolUnit(s.orgRepo, stu)
	labels := s.loadLabelMaps()

	pdf := fpdf.New("P", "mm", "A4", "")
	const fontName = "zh"
	pdf.AddUTF8Font(fontName, "", s.cfg.Export.PDFFontPath)
	if pdf.Err() {
		return nil, "", NewValidationError("加载中文字体失败，请检查 export.pdf_font_path")
	}
	pdf.SetFont(fontName, "", 11)
	pdf.AddPage()

	w := &pdfWriter{pdf: pdf, font: fontName}
	w.title("贵州省高等学校国家助学金申请表")

	w.section("本人情况")
	if stu != nil {
		w.kv("姓名", stu.Name)
		w.kv("性别", genderLabel(stu.Gender))
		if stu.Birth != nil {
			w.kv("出生年月", stu.Birth.Format("2006.01"))
		}
		w.kv("民族", labels.label("nation", stu.Nation))
		w.kv("政治面貌", labels.label("political_status", stu.PoliticalStatus))
		if stu.EnrollTime != nil {
			w.kv("入学时间", stu.EnrollTime.Format("2006.01"))
		}
		w.kv("学号", stu.StudentNo)
		w.kv("所在年级", gradeName)
		w.kv("身份证号码", stu.IDCard)
	}
	w.kv("联系电话", a.Phone)
	w.kv("院系专业班级", schoolUnit)

	w.section("家庭经济情况")
	w.kv("家庭户口", householdLabel(a.HouseholdType))
	w.kv("家庭总人数", fmt.Sprintf("%d 人", a.FamilyPopulation))
	w.kv("家庭月总收入", fmt.Sprintf("%.0f 元", a.MonthlyIncome))
	w.kv("人均月收入", fmt.Sprintf("%.0f 元", a.PerCapitaMonthlyIncome))
	w.kv("收入来源", labels.label("income_source", a.IncomeSource))
	w.kv("家庭住址", a.Address)
	w.kv("邮政编码", a.PostalCode)

	w.section("家庭成员情况")
	w.grantMemberTable(a.FamilyMembers, labels)

	w.section("申请理由")
	w.kv("", a.Reason)
	w.note("申请人签名：____________    年    月    日")

	w.section("院系审核意见")
	deptOpinion := grantReviewOpinion(a.Reviews, model.LevelDepartment)
	w.kv("教学系意见", deptOpinion)
	w.note("教学系领导签署意见、盖章（公章）    年    月    日")

	w.section("学院审核意见")
	collegeOpinion := grantReviewOpinion(a.Reviews, model.LevelCollege)
	w.kv("学院意见", collegeOpinion)
	w.note("（公章）    年    月    日")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, "", err
	}
	studentNo := ""
	if stu != nil {
		studentNo = stu.StudentNo
	}
	filename := fmt.Sprintf("grant_national_aid_%d_%s.pdf", a.Year, studentNo)
	return buf.Bytes(), filename, nil
}

func (s *GrantPDFService) loadLabelMaps() labelMaps {
	types := []string{"nation", "political_status", "income_source", "relation"}
	maps := make(map[string]map[string]string, len(types))
	for _, t := range types {
		m := map[string]string{}
		if items, err := s.dictRepo.ListByType(t); err == nil {
			for i := range items {
				m[items[i].Code] = items[i].Label
			}
		}
		maps[t] = m
	}
	return labelMaps{maps: maps}
}

func grantReviewOpinion(reviews []model.GrantReviewRecord, level model.ReviewLevel) string {
	for i := len(reviews) - 1; i >= 0; i-- {
		r := reviews[i]
		if r.Level == level && r.Action == model.ActionPass {
			if strings.TrimSpace(r.Opinion) != "" {
				return r.Opinion
			}
			return "同意"
		}
	}
	return ""
}

func (w *pdfWriter) grantMemberTable(members []model.GrantFamilyMember, labels labelMaps) {
	headers := []string{"姓名", "年龄", "与本人关系", "工作或学习单位"}
	widths := []float64{28, 18, 32, 112}
	for i, h := range headers {
		w.pdf.CellFormat(widths[i], 8, h, "1", 0, "C", false, 0, "")
	}
	w.pdf.Ln(-1)
	if len(members) == 0 {
		w.pdf.CellFormat(0, 8, "（无）", "1", 1, "L", false, 0, "")
		return
	}
	for _, m := range members {
		cells := []string{m.Name, fmt.Sprintf("%d", m.Age), labels.label("relation", m.Relation), m.WorkUnit}
		for i, c := range cells {
			w.pdf.CellFormat(widths[i], 8, c, "1", 0, "L", false, 0, "")
		}
		w.pdf.Ln(-1)
	}
}
