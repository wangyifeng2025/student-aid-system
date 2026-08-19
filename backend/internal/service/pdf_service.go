package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"gorm.io/gorm"
)

// RecognitionPDFService 认定申请表导出（仅认定通过后可导出）。
// 导出格式为 docx：基于 assets/templates/recognition_application.docx 模板填数。
type RecognitionPDFService struct {
	cfg      *config.Config
	repo     *repository.RecognitionRepository
	stuRepo  *repository.StudentRepository
	orgRepo  *repository.OrgRepository
	dictRepo *repository.DictRepository
	attRepo  *repository.AttachmentRepository
}

func NewRecognitionPDFService(db *gorm.DB, cfg *config.Config) *RecognitionPDFService {
	return &RecognitionPDFService{
		cfg:      cfg,
		repo:     repository.NewRecognitionRepository(db),
		stuRepo:  repository.NewStudentRepository(db),
		orgRepo:  repository.NewOrgRepository(db),
		dictRepo: repository.NewDictRepository(db),
		attRepo:  repository.NewAttachmentRepository(db),
	}
}

// Export 基于 Word 模板填数，生成《家庭经济困难学生认定申请表》docx。
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
		return nil, "", NewValidationError("仅认定通过的申请可导出申请表")
	}

	stu, _ := s.stuRepo.FindStudentUnscoped(a.StudentID)
	dept, major, grade, class := resolveStudentOrgNames(s.orgRepo, stu)
	labels := s.loadLabelMaps()
	replacements := buildRecognitionDocxReplacements(s.cfg, a, stu, dept, major, grade, class, labels)
	signaturePNG := s.loadStudentSignaturePNG(id)

	docxBytes, err := exportRecognitionDocx(s.cfg, replacements, signaturePNG)
	if err != nil {
		return nil, "", err
	}
	studentNo := ""
	if stu != nil {
		studentNo = stu.StudentNo
	}
	filename := fmt.Sprintf("recognition_%d_%s.docx", a.Year, studentNo)
	return docxBytes, filename, nil
}

// loadStudentSignaturePNG 读取认定申请的手写签字附件；不存在则返回 nil。
func (s *RecognitionPDFService) loadStudentSignaturePNG(appID uint) []byte {
	items, err := s.attRepo.ListByOwner(OwnerTypeRecognition, appID)
	if err != nil {
		return nil
	}
	var rel string
	for i := range items {
		if items[i].FileName == studentSignatureFile {
			rel = items[i].Path
			break
		}
	}
	if rel == "" || s.cfg == nil {
		return nil
	}
	data, err := os.ReadFile(filepath.Join(s.cfg.Upload.Dir, rel))
	if err != nil || len(data) == 0 {
		return nil
	}
	return data
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

// ===== 标签工具 =====

func orNone(s string) string {
	if strings.TrimSpace(s) == "" {
		return "无"
	}
	return s
}

func genderLabel(g string) string {
	switch g {
	case "male", "M", "男":
		return "男"
	case "female", "F", "女":
		return "女"
	default:
		return g
	}
}
