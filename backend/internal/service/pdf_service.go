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

// RecognitionPDFService 认定申请表 PDF 导出（仅认定通过后可导出）。
type RecognitionPDFService struct {
	cfg      *config.Config
	repo     *repository.RecognitionRepository
	stuRepo  *repository.StudentRepository
	dictRepo *repository.DictRepository
}

func NewRecognitionPDFService(db *gorm.DB, cfg *config.Config) *RecognitionPDFService {
	return &RecognitionPDFService{
		cfg:      cfg,
		repo:     repository.NewRecognitionRepository(db),
		stuRepo:  repository.NewStudentRepository(db),
		dictRepo: repository.NewDictRepository(db),
	}
}

// Export 生成认定申请表 PDF，返回字节与建议文件名。
func (s *RecognitionPDFService) Export(actor rbac.Actor, id uint) ([]byte, string, error) {
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
	if a.Status != model.StatusApproved {
		return nil, "", NewValidationError("仅认定通过的申请可导出 PDF")
	}
	if strings.TrimSpace(s.cfg.Export.PDFFontPath) == "" {
		return nil, "", NewValidationError("服务端未配置中文字体（export.pdf_font_path），无法导出 PDF，请联系管理员")
	}
	stu, _ := s.stuRepo.FindStudent(a.StudentID)

	labels := s.loadLabelMaps()
	pdf := fpdf.New("P", "mm", "A4", "")
	const fontName = "zh"
	pdf.AddUTF8Font(fontName, "", s.cfg.Export.PDFFontPath)
	if pdf.Err() {
		return nil, "", NewValidationError("加载中文字体失败，请检查 export.pdf_font_path 指向的 TTF 字体文件")
	}
	pdf.SetFont(fontName, "", 11)
	pdf.AddPage()

	writer := &pdfWriter{pdf: pdf, font: fontName}
	writer.title(fmt.Sprintf("%d 年度家庭经济困难学生认定申请表", a.Year))

	writer.section("一、基本情况")
	studentNo, studentName := "", ""
	if stu != nil {
		studentNo, studentName = stu.StudentNo, stu.Name
	}
	writer.kv("姓名", studentName)
	writer.kv("学号", studentNo)
	writer.kv("民族", labels.label("nation", a.Nation))
	writer.kv("籍贯", a.NativePlace)
	writer.kv("身份证号", a.IDCard)
	writer.kv("家庭人口", fmt.Sprintf("%d", a.FamilyPopulation))
	writer.kv("本人手机号", a.Phone)
	writer.kv("家长手机号", a.GuardianPhone)
	writer.kv("通讯地址", a.Address)
	writer.kv("邮政编码", a.PostalCode)

	writer.section("二、家庭经济情况")
	writer.kv("户口类型", householdLabel(a.HouseholdType))
	writer.kv("家庭人均年收入", fmt.Sprintf("%.2f 元", a.PerCapitaAnnualIncome))
	writer.kv("收入来源", labels.label("income_source", a.IncomeSource))
	writer.kv("特殊群体", labels.joinSpecial(a.SpecialTypes))

	writer.section("三、家庭成员")
	writer.memberTable(a.FamilyMembers, labels)

	writer.section("四、影响家庭经济状况有关信息")
	writer.kv("自然灾害", orNone(a.NaturalDisaster))
	writer.kv("突发意外", orNone(a.SuddenAccident))
	writer.kv("劳动力弱", orNone(a.WeakLabor))
	writer.kv("失业情况", orNone(a.Unemployment))
	writer.kv("欠债情况", orNone(a.Debt))
	writer.kv("其他情况", orNone(a.OtherInfo))

	writer.section("五、认定结果")
	writer.kv("困难等级", difficultyLabel(a.DifficultyLevel))
	writer.kv("个人承诺", boolLabel(a.CommitmentAgreed))
	writer.note("说明：本表个人承诺与签字须本人手写，请打印后线下签字归档。")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, "", err
	}
	filename := fmt.Sprintf("recognition_%d_%s.pdf", a.Year, studentNo)
	return buf.Bytes(), filename, nil
}

// ===== 标签映射 =====

type labelMaps struct {
	maps map[string]map[string]string
}

func (l labelMaps) label(dictType, code string) string {
	if code == "" {
		return ""
	}
	if m, ok := l.maps[dictType]; ok {
		if v, ok := m[code]; ok {
			return v
		}
	}
	return code
}

func (l labelMaps) joinSpecial(csv string) string {
	parts := strings.Split(csv, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		out = append(out, l.label("special_group_type", p))
	}
	if len(out) == 0 {
		return "无"
	}
	return strings.Join(out, "、")
}

func (s *RecognitionPDFService) loadLabelMaps() labelMaps {
	types := []string{"nation", "income_source", "relation", "occupation", "health_status", "special_group_type"}
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

// ===== PDF 写入辅助 =====

type pdfWriter struct {
	pdf  *fpdf.Fpdf
	font string
}

func (w *pdfWriter) title(text string) {
	w.pdf.SetFont(w.font, "", 16)
	w.pdf.CellFormat(0, 12, text, "", 1, "C", false, 0, "")
	w.pdf.Ln(2)
	w.pdf.SetFont(w.font, "", 11)
}

func (w *pdfWriter) section(text string) {
	w.pdf.Ln(2)
	w.pdf.SetFont(w.font, "", 13)
	w.pdf.CellFormat(0, 9, text, "B", 1, "L", false, 0, "")
	w.pdf.SetFont(w.font, "", 11)
	w.pdf.Ln(1)
}

func (w *pdfWriter) kv(key, value string) {
	w.pdf.CellFormat(40, 8, key, "", 0, "L", false, 0, "")
	w.pdf.MultiCell(0, 8, value, "", "L", false)
}

func (w *pdfWriter) note(text string) {
	w.pdf.Ln(2)
	w.pdf.SetFontSize(9)
	w.pdf.MultiCell(0, 6, text, "", "L", false)
	w.pdf.SetFontSize(11)
}

func (w *pdfWriter) memberTable(members []model.FamilyMember, labels labelMaps) {
	headers := []string{"姓名", "年龄", "关系", "单位", "职业", "年收入", "健康"}
	widths := []float64{28, 14, 22, 46, 24, 28, 28}
	for i, h := range headers {
		w.pdf.CellFormat(widths[i], 8, h, "1", 0, "C", false, 0, "")
	}
	w.pdf.Ln(-1)
	if len(members) == 0 {
		w.pdf.CellFormat(0, 8, "（无家庭成员）", "1", 1, "L", false, 0, "")
		return
	}
	for _, m := range members {
		cells := []string{
			m.Name,
			fmt.Sprintf("%d", m.Age),
			labels.label("relation", m.Relation),
			m.WorkUnit,
			labels.label("occupation", m.Occupation),
			fmt.Sprintf("%.0f", m.AnnualIncome),
			labels.label("health_status", m.Health),
		}
		for i, c := range cells {
			w.pdf.CellFormat(widths[i], 8, c, "1", 0, "L", false, 0, "")
		}
		w.pdf.Ln(-1)
	}
}

// ===== 标签工具 =====

func orNone(s string) string {
	if strings.TrimSpace(s) == "" {
		return "无"
	}
	return s
}

func householdLabel(t model.HouseholdType) string {
	switch t {
	case model.HouseholdUrban:
		return "城镇"
	case model.HouseholdRural:
		return "农村"
	default:
		return ""
	}
}

func difficultyLabel(d model.DifficultyLevel) string {
	switch d {
	case model.DifficultySpecial:
		return "特别困难"
	case model.DifficultyHard:
		return "比较困难"
	case model.DifficultyGeneral:
		return "一般困难"
	default:
		return "（未定级）"
	}
}

func boolLabel(b bool) string {
	if b {
		return "已确认"
	}
	return "未确认"
}
