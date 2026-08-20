package service

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

const (
	recognitionSummarySheet            = "Sheet1"
	recognitionSummaryDataStart        = 4
	recognitionSummaryTemplateLastData = 367
	recognitionSummaryFallbackRel      = "./assets/templates/recognition_result_summary.xlsx"
)

// RecognitionSummaryExportService 按官方《认定结果汇总表》模板导出 Excel。
type RecognitionSummaryExportService struct {
	cfg      *config.Config
	repo     *repository.RecognitionRepository
	stuRepo  *repository.StudentRepository
	orgRepo  *repository.OrgRepository
	dictRepo *repository.DictRepository
	userRepo *repository.UserRepository
}

func NewRecognitionSummaryExportService(db *gorm.DB, cfg *config.Config) *RecognitionSummaryExportService {
	return &RecognitionSummaryExportService{
		cfg:      cfg,
		repo:     repository.NewRecognitionRepository(db),
		stuRepo:  repository.NewStudentRepository(db),
		orgRepo:  repository.NewOrgRepository(db),
		dictRepo: repository.NewDictRepository(db),
		userRepo: repository.NewUserRepository(db),
	}
}

type recognitionSummaryMeta struct {
	School   string
	Year     int
	DeptName string
	Leader   string
}

type recognitionSummaryRow struct {
	StudentNo  string
	DeptName   string
	Name       string
	Gender     string
	Nation     string
	Grade      string
	ClassName  string
	IDCard     string
	Address    string
	Phone      string
	Difficulty string
	Basis      string
	Remark     string
}

// Export 导出数据范围内已认定通过的汇总表（班主任/教学系/资助中心/管理员）。
func (s *RecognitionSummaryExportService) Export(actor rbac.Actor, f repository.RecognitionFilter) ([]byte, string, string, error) {
	if actor.Role == model.RoleStudent {
		return nil, "", "", ErrForbidden
	}
	if !isReviewerRole(actor.Role) && actor.Role != model.RoleAdmin {
		return nil, "", "", ErrForbidden
	}

	f.Status = string(model.StatusApproved)
	f.Page = 0
	f.PageSize = 0
	items, _, err := s.repo.List(actor, f)
	if err != nil {
		return nil, "", "", err
	}

	ids := make([]uint, 0, len(items))
	for i := range items {
		ids = append(ids, items[i].StudentID)
	}
	students, err := s.stuRepo.FindMapByIDs(ids)
	if err != nil {
		return nil, "", "", err
	}
	deptNames, _, classNames, err := buildOrgNameMaps(s.orgRepo)
	if err != nil {
		return nil, "", "", err
	}
	gradeByClass, err := s.classGradeNames()
	if err != nil {
		return nil, "", "", err
	}
	labels := s.loadLabelMaps()

	rows := make([]recognitionSummaryRow, 0, len(items))
	for i := range items {
		a := &items[i]
		stu := students[a.StudentID]
		deptName := deptNames[stu.DeptID]
		className := classNames[stu.ClassID]
		nation := labels.label("nation", firstNonEmpty(a.Nation, stu.Nation))
		rows = append(rows, recognitionSummaryRow{
			StudentNo:  stu.StudentNo,
			DeptName:   deptName,
			Name:       firstNonEmpty(stu.Name),
			Gender:     genderLabel(stu.Gender),
			Nation:     nation,
			Grade:      gradeByClass[stu.ClassID],
			ClassName:  className,
			IDCard:     firstNonEmpty(a.IDCard, stu.IDCard),
			Address:    a.Address,
			Phone:      firstNonEmpty(a.Phone, stu.Phone),
			Difficulty: summaryDifficultyLabel(a.DifficultyLevel),
			Basis:      summaryBasis(a.SpecialTypes, labels),
		})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].DeptName != rows[j].DeptName {
			return rows[i].DeptName < rows[j].DeptName
		}
		if rows[i].ClassName != rows[j].ClassName {
			return rows[i].ClassName < rows[j].ClassName
		}
		return rows[i].StudentNo < rows[j].StudentNo
	})

	year := f.Year
	if year == 0 {
		year = uniqueYear(items)
	}
	meta := recognitionSummaryMeta{
		School:   schoolNameForExport(s.cfg),
		Year:     year,
		DeptName: s.headerDeptName(actor, f.DeptID, deptNames, rows),
		Leader:   s.actorName(actor.UserID),
	}

	path := recognitionSummaryTemplatePath(s.cfg)
	data, err := fillRecognitionSummaryXLSX(path, meta, rows)
	if err != nil {
		return nil, "", "", err
	}
	utf8Name, asciiName := recognitionSummaryDownloadNames(
		actor.Role,
		s.headerClassName(actor, f.ClassID, classNames, rows),
		meta.DeptName,
	)
	return data, utf8Name, asciiName, nil
}

func (s *RecognitionSummaryExportService) loadLabelMaps() labelMaps {
	types := []string{"nation", "special_group_type"}
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

func (s *RecognitionSummaryExportService) classGradeNames() (map[uint]string, error) {
	grades, err := s.orgRepo.ListGrades()
	if err != nil {
		return nil, err
	}
	gradeNames := make(map[uint]string, len(grades))
	for i := range grades {
		gradeNames[grades[i].ID] = grades[i].Name
	}
	classes, err := s.orgRepo.ListClasses(repository.ClassFilter{})
	if err != nil {
		return nil, err
	}
	out := make(map[uint]string, len(classes))
	for i := range classes {
		out[classes[i].ID] = gradeNames[classes[i].GradeID]
	}
	return out, nil
}

func (s *RecognitionSummaryExportService) actorName(userID uint) string {
	if userID == 0 {
		return ""
	}
	u, err := s.userRepo.FindByID(userID)
	if err != nil || u == nil {
		return ""
	}
	if strings.TrimSpace(u.RealName) != "" {
		return strings.TrimSpace(u.RealName)
	}
	return u.Username
}

func (s *RecognitionSummaryExportService) headerDeptName(actor rbac.Actor, filterDeptID uint, deptNames map[uint]string, rows []recognitionSummaryRow) string {
	if filterDeptID > 0 {
		return deptNames[filterDeptID]
	}
	if actor.DeptID != nil && *actor.DeptID > 0 {
		return deptNames[*actor.DeptID]
	}
	return uniqueRowField(rows, func(r recognitionSummaryRow) string { return r.DeptName })
}

func (s *RecognitionSummaryExportService) headerClassName(actor rbac.Actor, filterClassID uint, classNames map[uint]string, rows []recognitionSummaryRow) string {
	if filterClassID > 0 {
		return classNames[filterClassID]
	}
	if actor.ClassID != nil && *actor.ClassID > 0 {
		return classNames[*actor.ClassID]
	}
	return uniqueRowField(rows, func(r recognitionSummaryRow) string { return r.ClassName })
}

func uniqueRowField(rows []recognitionSummaryRow, get func(recognitionSummaryRow) string) string {
	seen := map[string]struct{}{}
	var only string
	for i := range rows {
		name := strings.TrimSpace(get(rows[i]))
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		only = name
	}
	if len(seen) == 1 {
		return only
	}
	return ""
}

func summaryDifficultyLabel(d model.DifficultyLevel) string {
	switch d {
	case model.DifficultySpecial:
		return "特别困难"
	case model.DifficultyHard:
		return "比较困难"
	case model.DifficultyGeneral:
		return "一般困难"
	default:
		return ""
	}
}

func summaryBasis(csv string, labels labelMaps) string {
	text := labels.joinSpecial(csv)
	if text == "" || text == "无" {
		return "一般家庭经济困难"
	}
	return text
}

func uniqueYear(items []model.RecognitionApplication) int {
	seen := map[int]struct{}{}
	year := 0
	for i := range items {
		if items[i].Year <= 0 {
			continue
		}
		seen[items[i].Year] = struct{}{}
		year = items[i].Year
	}
	if len(seen) == 1 {
		return year
	}
	return 0
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if s := strings.TrimSpace(v); s != "" {
			return s
		}
	}
	return ""
}

// recognitionSummaryDownloadNames 按教师角色生成汇总表下载文件名。
// 班主任：{班级名}-困难认定汇总表；教学系：{系名}-困难认定汇总表；资助中心/管理员：学院困难认定汇总表。
func recognitionSummaryDownloadNames(role model.Role, className, deptName string) (utf8Name, asciiName string) {
	switch role {
	case model.RoleClassAdvisor:
		name := firstNonEmpty(className, "班级")
		return sanitizeDownloadName(name) + "-困难认定汇总表.xlsx", "class_summary.xlsx"
	case model.RoleDepartment:
		name := firstNonEmpty(deptName, "系")
		return sanitizeDownloadName(name) + "-困难认定汇总表.xlsx", "dept_summary.xlsx"
	case model.RoleAidCenter, model.RoleAdmin:
		return "学院困难认定汇总表.xlsx", "college_summary.xlsx"
	default:
		return "困难认定汇总表.xlsx", "recognition_summary.xlsx"
	}
}

func recognitionSummaryTemplatePath(cfg *config.Config) string {
	configured := ""
	if cfg != nil {
		configured = strings.TrimSpace(cfg.Export.RecognitionSummaryTemplatePath)
	}
	return resolveAssetPath(configured, recognitionSummaryFallbackRel)
}

func resolveAssetPath(configured, fallbackRel string) string {
	try := func(p string) string {
		p = strings.TrimSpace(p)
		if p == "" {
			return ""
		}
		if _, err := os.Stat(p); err == nil {
			return p
		}
		if filepath.IsAbs(p) {
			return ""
		}
		if root := findGoModDir(); root != "" {
			abs := filepath.Join(root, strings.TrimPrefix(p, "./"))
			if _, err := os.Stat(abs); err == nil {
				return abs
			}
		}
		return ""
	}
	if p := try(configured); p != "" {
		return p
	}
	if p := try(fallbackRel); p != "" {
		return p
	}
	if configured != "" {
		return configured
	}
	return fallbackRel
}

func findGoModDir() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}

func summaryTitle(school string, year int) string {
	if year > 0 {
		return fmt.Sprintf("%s\n%d-%d学年家庭经济困难学生认定结果汇总表", school, year, year+1)
	}
	return school + "\n家庭经济困难学生认定结果汇总表"
}

func fillRecognitionSummaryXLSX(templatePath string, meta recognitionSummaryMeta, rows []recognitionSummaryRow) ([]byte, error) {
	f, err := excelize.OpenFile(templatePath)
	if err != nil {
		return nil, NewValidationError(fmt.Sprintf("读取认定汇总表模板失败（%s），请联系管理员", templatePath))
	}
	defer func() { _ = f.Close() }()

	sheet := recognitionSummarySheet
	if err := f.SetCellValue(sheet, "A1", summaryTitle(meta.School, meta.Year)); err != nil {
		return nil, err
	}
	if err := f.SetCellValue(sheet, "D2", meta.DeptName); err != nil {
		return nil, err
	}
	if err := f.SetCellValue(sheet, "L2", meta.Leader); err != nil {
		return nil, err
	}

	capacity := recognitionSummaryTemplateLastData - recognitionSummaryDataStart + 1
	n := len(rows)
	if n > capacity {
		extra := n - capacity
		for i := 0; i < extra; i++ {
			if err := f.DuplicateRow(sheet, recognitionSummaryTemplateLastData+i); err != nil {
				return nil, err
			}
		}
	}

	for i := range rows {
		r := recognitionSummaryDataStart + i
		axis, err := excelize.CoordinatesToCellName(1, r)
		if err != nil {
			return nil, err
		}
		vals := []any{
			i + 1,
			rows[i].DeptName,
			rows[i].Name,
			rows[i].Gender,
			rows[i].Nation,
			rows[i].Grade,
			rows[i].ClassName,
			rows[i].IDCard,
			rows[i].Address,
			rows[i].Phone,
			rows[i].Difficulty,
			rows[i].Basis,
			rows[i].Remark,
		}
		if err := f.SetSheetRow(sheet, axis, &vals); err != nil {
			return nil, err
		}
	}

	keepLast := recognitionSummaryDataStart + n - 1
	if n == 0 {
		keepLast = recognitionSummaryDataStart
		_ = f.SetCellValue(sheet, "A4", "")
	}
	if n <= capacity {
		for r := recognitionSummaryTemplateLastData; r > keepLast; r-- {
			if err := f.RemoveRow(sheet, r); err != nil {
				return nil, err
			}
		}
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
