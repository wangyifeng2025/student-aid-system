package service

import (
	"bytes"
	"os"
	"strings"

	"github.com/go-pdf/fpdf"
	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"gorm.io/gorm"
)

// GrantPDFService 国家助学金申请表 PDF 导出（审批通过后可导出）。
// 版式对齐《贵州省高等学校国家助学金申请表》，需配置中文字体。
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
		return nil, "", NewValidationError("仅审批通过的助学金申请可导出申请表")
	}

	fontPath := resolvePDFFontPath(s.cfg)
	fontBytes, err := os.ReadFile(fontPath)
	if err != nil || len(fontBytes) == 0 {
		return nil, "", NewValidationError("服务端未配置中文字体（export.pdf_font_path），无法导出 PDF，请联系管理员")
	}

	stu, _ := s.stuRepo.FindStudentUnscoped(a.StudentID)
	schoolUnit, gradeName := resolveGrantSchoolUnit(s.orgRepo, stu)
	labels := s.loadLabelMaps()
	form := buildGrantFormData(a, stu, grantSchoolUnitText(s.cfg, schoolUnit), gradeName, labels)

	pdf := fpdf.New("P", "mm", "A4", "")
	const fontName = "zh"
	pdf.AddUTF8FontFromBytes(fontName, "", fontBytes)
	if pdf.Err() {
		return nil, "", NewValidationError("加载中文字体失败，请检查 export.pdf_font_path 指向的 TTF 字体文件")
	}
	pdf.SetMargins(grantPdfMarginL, grantPdfMarginT, grantPdfMarginL)
	pdf.SetAutoPageBreak(false, grantPdfMarginB)
	pdf.AddPage()
	renderOfficialGrantForm(pdf, fontName, form)
	if pdf.Err() {
		return nil, "", pdf.Error()
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, "", err
	}
	return buf.Bytes(), grantPDFFilename(stu), nil
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
