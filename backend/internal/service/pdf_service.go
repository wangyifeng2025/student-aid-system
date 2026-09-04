package service

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-pdf/fpdf"
	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"gorm.io/gorm"
)

// RecognitionPDFService 认定申请表导出（仅认定通过后可导出）。
// 导出格式为 PDF：按官方认定申请表版式用 fpdf 绘制，需配置中文字体。
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

// Export 生成《家庭经济困难学生认定申请表》PDF。
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

	fontPath := resolvePDFFontPath(s.cfg)
	fontBytes, err := os.ReadFile(fontPath)
	if err != nil || len(fontBytes) == 0 {
		return nil, "", NewValidationError("服务端未配置中文字体（export.pdf_font_path），无法导出 PDF，请联系管理员")
	}

	stu, _ := s.stuRepo.FindStudentUnscoped(a.StudentID)
	dept, major, grade, class := resolveStudentOrgNames(s.orgRepo, stu)
	labels := s.loadLabelMaps()
	signaturePNG := s.loadStudentSignaturePNG(id)

	pdf := fpdf.New("P", "mm", "A4", "")
	const fontName = "zh"
	pdf.AddUTF8FontFromBytes(fontName, "", fontBytes)
	if pdf.Err() {
		return nil, "", NewValidationError("加载中文字体失败，请检查 export.pdf_font_path 指向的 TTF 字体文件")
	}
	pdf.SetMargins(pdfMarginL, 12, pdfMarginL)
	pdf.SetAutoPageBreak(true, 12)
	pdf.AddPage()
	renderOfficialRecognitionForm(pdf, fontName, s.cfg, a, stu, dept, major, grade, class, labels, signaturePNG)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, "", err
	}
	return buf.Bytes(), recognitionPDFFilename(stu), nil
}

func resolvePDFFontPath(cfg *config.Config) string {
	if cfg != nil && strings.TrimSpace(cfg.Export.PDFFontPath) != "" {
		return strings.TrimSpace(cfg.Export.PDFFontPath)
	}
	return "./assets/fonts/NotoSansSC-Regular.ttf"
}

// recognitionPDFFilename 下载文件名：{申请人姓名}-困难认定申请表.pdf。
func recognitionPDFFilename(stu *model.Student) string {
	name := "申请人"
	if stu != nil {
		if n := strings.TrimSpace(stu.Name); n != "" {
			name = n
		}
	}
	return sanitizeDownloadName(name) + "-困难认定申请表.pdf"
}

// sanitizeDownloadName 去掉路径分隔符与常见非法文件名字符，避免下载头被注入或落盘失败。
func sanitizeDownloadName(s string) string {
	s = strings.TrimSpace(s)
	replacer := strings.NewReplacer(
		"/", "_",
		"\\", "_",
		":", "_",
		"*", "_",
		"?", "_",
		"\"", "_",
		"<", "_",
		">", "_",
		"|", "_",
		"\n", "",
		"\r", "",
	)
	s = replacer.Replace(s)
	if s == "" {
		return "申请人"
	}
	return s
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
