package service

import (
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

// 导入类型
const (
	ImportTypeStudents      = "students"
	ImportTypeSpecialGroups = "special-groups"
	ImportTypeDepartments   = "departments"
	ImportTypeMajors        = "majors"
	ImportTypeGrades        = "grades"
	ImportTypeClasses       = "classes"
	ImportTypeAdvisors      = "advisors"
)

// 模板列定义（表头顺序即列顺序）。
// 学生导入/导出使用中文名称（民族、政治面貌、院系、专业、班级），由后端在名称与编码/ID 之间双向转换。
var studentColumns = []string{
	"学号", "姓名", "性别", "身份证号", "手机号",
	"民族", "政治面貌", "院系", "专业", "班级",
	"出生年月(YYYY-MM-DD)", "入学时间(YYYY-MM-DD)",
}

var specialGroupColumns = []string{
	"学号", "身份证号", "姓名", "类型(编码)", "来源", "批次", "年度",
}

var departmentColumns = []string{"院系名称", "院系编码"}
var majorColumns = []string{"院系编码", "专业名称", "专业编码"}
var gradeColumns = []string{"年级名称", "入学年份"}
var classColumns = []string{"院系编码", "专业编码", "入学年份", "班级名称", "教工号"}
var advisorColumns = []string{"系部", "教工号", "姓名", "电话", "班级名称", "专业", "年级"}

// ImportService Excel 导入与模板生成。
type ImportService struct {
	stu      *StudentService
	sg       *SpecialGroupService
	sgR      *repository.SpecialGroupRepository
	org      *OrgService
	orgRepo  *repository.OrgRepository
	user     *repository.UserRepository
	dictRepo *repository.DictRepository
	advisor  *AdvisorService
}

func NewImportService(db *gorm.DB) *ImportService {
	return &ImportService{
		stu:      NewStudentService(db),
		sg:       NewSpecialGroupService(db),
		sgR:      repository.NewSpecialGroupRepository(db),
		org:      NewOrgService(db),
		orgRepo:  repository.NewOrgRepository(db),
		user:     repository.NewUserRepository(db),
		dictRepo: repository.NewDictRepository(db),
		advisor:  NewAdvisorService(db),
	}
}

// Template 生成指定类型的导入模板（xlsx 字节）。
func (s *ImportService) Template(kind string) ([]byte, string, error) {
	var (
		columns  []string
		example  []any
		filename string
	)
	switch kind {
	case ImportTypeStudents:
		columns = studentColumns
		example = []any{"2024010101", "张三", "男", "", "", "汉族", "共青团员", "信息工程学院", "软件工程", "软件2401班", "2006-01-01", "2024-09-01"}
		filename = "students_template.xlsx"
	case ImportTypeSpecialGroups:
		columns = specialGroupColumns
		example = []any{"2024010101", "", "张三", "poverty", "民政局", "2024秋", "2024"}
		filename = "special_groups_template.xlsx"
	case ImportTypeDepartments:
		columns = departmentColumns
		example = []any{"信息工程学院", "CS"}
		filename = "departments_template.xlsx"
	case ImportTypeMajors:
		columns = majorColumns
		example = []any{"CS", "软件工程", "SE"}
		filename = "majors_template.xlsx"
	case ImportTypeGrades:
		columns = gradeColumns
		example = []any{"2024级", 2024}
		filename = "grades_template.xlsx"
	case ImportTypeClasses:
		columns = classColumns
		example = []any{"CS", "SE", 2024, "软工2401班", "T2024001"}
		filename = "classes_template.xlsx"
	case ImportTypeAdvisors:
		columns = advisorColumns
		example = []any{"信息工程学院", "T2024001", "李老师", "13800001111", "", "", ""}
		filename = "advisors_template.xlsx"
	default:
		return nil, "", NewValidationError("不支持的模板类型")
	}

	f := excelize.NewFile()
	defer f.Close()
	sheet := "Sheet1"
	header := make([]any, len(columns))
	for i, c := range columns {
		header[i] = c
	}
	if err := f.SetSheetRow(sheet, "A1", &header); err != nil {
		return nil, "", err
	}
	if err := f.SetSheetRow(sheet, "A2", &example); err != nil {
		return nil, "", err
	}
	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, "", err
	}
	return buf.Bytes(), filename, nil
}

// readRows 读取上传文件首个工作表的所有行。
func readRows(r io.Reader) ([][]string, error) {
	f, err := excelize.OpenReader(r)
	if err != nil {
		return nil, NewValidationError("无法解析 Excel 文件，请使用模板另存为 .xlsx")
	}
	defer f.Close()
	sheet := f.GetSheetName(0)
	if sheet == "" {
		return nil, NewValidationError("Excel 中没有工作表")
	}
	return f.GetRows(sheet)
}

func cell(row []string, idx int) string {
	if idx < len(row) {
		return strings.TrimSpace(row[idx])
	}
	return ""
}

// ImportStudents 导入录取/新生名单，按学号增量 upsert，逐行回显错误。
// Excel 中民族、政治面貌填写中文名称；院系、专业、班级填写名称，由本函数
// 在导入前查字典与组织机构转换为内部 code/ID。
func (s *ImportService) ImportStudents(r io.Reader) (*dto.ImportResult, error) {
	rows, err := readRows(r)
	if err != nil {
		return nil, err
	}
	result := newImportResult()
	if err := checkImportHeader(rows, studentColumns, result); err != nil {
		return result, nil
	}

	// 预加载字典：label -> code
	nationMap, err := s.buildDictLabelToCode("nation")
	if err != nil {
		return nil, err
	}
	politicalMap, err := s.buildDictLabelToCode("political_status")
	if err != nil {
		return nil, err
	}
	// 预加载组织机构：名称 -> 对象，按需 deptID -> {name -> 对象}
	deptByName, majorByDept, classByDept, err := s.buildOrgNameMaps()
	if err != nil {
		return nil, err
	}

	for i, row := range rows {
		if i == 0 || isBlankRow(row) {
			continue
		}
		result.Total++
		excelRow := i + 1

		studentNo := cell(row, 0)
		if studentNo == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "学号", Message: "学号不能为空"})
			continue
		}
		name := cell(row, 1)
		if name == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "姓名", Message: "姓名不能为空"})
			continue
		}
		gender := cell(row, 2)
		if gender == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "性别", Message: "性别不能为空"})
			continue
		}
		if gender != "男" && gender != "女" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "性别", Message: "性别只能为“男”或“女”"})
			continue
		}
		idCard := strings.ToUpper(strings.TrimSpace(cell(row, 3)))
		if idCard == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "身份证号", Message: "身份证号不能为空"})
			continue
		}

		// 民族：名称 -> code（可空）
		nationName := cell(row, 5)
		nationCode := ""
		if nationName != "" {
			code, ok := nationMap[nationName]
			if !ok {
				result.Fail(dto.ImportRowError{Row: excelRow, Column: "民族", Message: "民族「" + nationName + "」不存在，请填写字典中的名称"})
				continue
			}
			nationCode = code
		}
		// 政治面貌：名称 -> code（可空）
		politicalName := cell(row, 6)
		politicalCode := ""
		if politicalName != "" {
			code, ok := politicalMap[politicalName]
			if !ok {
				result.Fail(dto.ImportRowError{Row: excelRow, Column: "政治面貌", Message: "政治面貌「" + politicalName + "」不存在，请填写字典中的名称"})
				continue
			}
			politicalCode = code
		}

		// 院系/专业/班级：名称 -> ID（必填）
		deptName := cell(row, 7)
		if deptName == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "院系", Message: "院系不能为空"})
			continue
		}
		dept, ok := deptByName[deptName]
		if !ok {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "院系", Message: "院系「" + deptName + "」不存在"})
			continue
		}
		majorName := cell(row, 8)
		if majorName == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "专业", Message: "专业不能为空"})
			continue
		}
		major, ok := majorByDept[dept.ID][majorName]
		if !ok {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "专业", Message: "院系「" + deptName + "」下不存在专业「" + majorName + "」"})
			continue
		}
		className := cell(row, 9)
		if className == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "班级", Message: "班级不能为空"})
			continue
		}
		class, ok := classByDept[dept.ID][className]
		if !ok {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "班级", Message: "院系「" + deptName + "」下不存在班级「" + className + "」"})
			continue
		}

		req := &dto.StudentRequest{
			StudentNo:       studentNo,
			Name:            name,
			Gender:          gender,
			IDCard:          idCard,
			Phone:           cell(row, 4),
			Nation:          nationCode,
			PoliticalStatus: politicalCode,
			DeptID:          dept.ID,
			MajorID:         major.ID,
			ClassID:         class.ID,
			Birth:           cell(row, 10),
			EnrollTime:      cell(row, 11),
		}
		if _, err := s.stu.Upsert(req); err != nil {
			failRow(result, excelRow, "", err)
			continue
		}
		result.Success++
	}
	return result, nil
}

// buildDictLabelToCode 构建「字典 label -> code」映射（用于导入名称转编码）。
func (s *ImportService) buildDictLabelToCode(dictType string) (map[string]string, error) {
	items, err := s.dictRepo.ListByType(dictType)
	if err != nil {
		return nil, err
	}
	m := make(map[string]string, len(items))
	for i := range items {
		m[items[i].Label] = items[i].Code
	}
	return m, nil
}

// buildDictCodeToLabel 构建「字典 code -> label」映射（用于导出编码转名称）。
func (s *ImportService) buildDictCodeToLabel(dictType string) (map[string]string, error) {
	items, err := s.dictRepo.ListByType(dictType)
	if err != nil {
		return nil, err
	}
	m := make(map[string]string, len(items))
	for i := range items {
		m[items[i].Code] = items[i].Label
	}
	return m, nil
}

// buildOrgNameMaps 预加载组织机构映射，供学生导入按名称解析 ID：
//   - deptByName: 院系名称 -> *Department
//   - majorByDept: deptID -> {专业名称 -> *Major}
//   - classByDept: deptID -> {班级名称 -> *Class}
func (s *ImportService) buildOrgNameMaps() (map[string]*model.Department, map[uint]map[string]*model.Major, map[uint]map[string]*model.Class, error) {
	depts, err := s.orgRepo.ListDepartments()
	if err != nil {
		return nil, nil, nil, err
	}
	deptByName := make(map[string]*model.Department, len(depts))
	for i := range depts {
		deptByName[depts[i].Name] = &depts[i]
	}
	majors, err := s.orgRepo.ListMajors(0)
	if err != nil {
		return nil, nil, nil, err
	}
	majorByDept := map[uint]map[string]*model.Major{}
	for i := range majors {
		dm := majorByDept[majors[i].DeptID]
		if dm == nil {
			dm = map[string]*model.Major{}
			majorByDept[majors[i].DeptID] = dm
		}
		dm[majors[i].Name] = &majors[i]
	}
	classes, err := s.orgRepo.ListClasses(repository.ClassFilter{})
	if err != nil {
		return nil, nil, nil, err
	}
	classByDept := map[uint]map[string]*model.Class{}
	for i := range classes {
		cm := classByDept[classes[i].DeptID]
		if cm == nil {
			cm = map[string]*model.Class{}
			classByDept[classes[i].DeptID] = cm
		}
		cm[classes[i].Name] = &classes[i]
	}
	return deptByName, majorByDept, classByDept, nil
}

// buildOrgIDToNameMaps 预加载组织机构映射，供学生导出按 ID 解析名称：
//   - deptNames: deptID -> 院系名称
//   - majorNames: majorID -> 专业名称
//   - classNames: classID -> 班级名称
func (s *ImportService) buildOrgIDToNameMaps() (map[uint]string, map[uint]string, map[uint]string, error) {
	return buildOrgNameMaps(s.orgRepo)
}

// ImportSpecialGroups 导入重点人群名单，已存在(同身份+类型+年度)则跳过，逐行回显错误。
func (s *ImportService) ImportSpecialGroups(r io.Reader) (*dto.ImportResult, error) {
	rows, err := readRows(r)
	if err != nil {
		return nil, err
	}
	result := newImportResult()
	if err := checkImportHeader(rows, specialGroupColumns, result); err != nil {
		return result, nil
	}
	for i, row := range rows {
		if i == 0 || isBlankRow(row) {
			continue
		}
		result.Total++
		excelRow := i + 1

		studentNo := cell(row, 0)
		idCard := cell(row, 1)
		if studentNo == "" && idCard == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "学号", Message: "学号与身份证号至少填写一项"})
			continue
		}
		sgType := cell(row, 3)
		if sgType == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "类型(编码)", Message: "类型(编码)不能为空"})
			continue
		}
		year, yerr := parseIntCell(row, 6)
		if yerr != nil || year <= 0 {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "年度", Message: "年度必须为正整数"})
			continue
		}
		req := &dto.SpecialGroupRequest{
			StudentNo: studentNo,
			IDCard:    idCard,
			Name:      cell(row, 2),
			Type:      sgType,
			Source:    cell(row, 4),
			Batch:     cell(row, 5),
			Year:      year,
		}
		dup, derr := s.sgR.DupExists(req.StudentNo, strings.ToUpper(req.IDCard), req.Type, req.Year)
		if derr != nil {
			return nil, derr
		}
		if dup {
			result.Success++
			continue
		}
		if _, err := s.sg.Create(req); err != nil {
			failRow(result, excelRow, "", err)
			continue
		}
		result.Success++
	}
	return result, nil
}

// ImportDepartments 导入院系，按编码 upsert。
func (s *ImportService) ImportDepartments(r io.Reader) (*dto.ImportResult, error) {
	rows, err := readRows(r)
	if err != nil {
		return nil, err
	}
	result := newImportResult()
	if err := checkImportHeader(rows, departmentColumns, result); err != nil {
		return result, nil
	}
	for i, row := range rows {
		if i == 0 || isBlankRow(row) {
			continue
		}
		result.Total++
		excelRow := i + 1
		name := cell(row, 0)
		if name == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "院系名称", Message: "院系名称不能为空"})
			continue
		}
		req := &dto.DepartmentRequest{Name: name, Code: cell(row, 1)}
		if err := s.org.UpsertDepartment(req); err != nil {
			failRow(result, excelRow, "院系名称", err)
			continue
		}
		result.Success++
	}
	return result, nil
}

// ImportMajors 导入专业，按院系编码 + 专业编码/名称 upsert。
func (s *ImportService) ImportMajors(r io.Reader) (*dto.ImportResult, error) {
	rows, err := readRows(r)
	if err != nil {
		return nil, err
	}
	result := newImportResult()
	if err := checkImportHeader(rows, majorColumns, result); err != nil {
		return result, nil
	}
	for i, row := range rows {
		if i == 0 || isBlankRow(row) {
			continue
		}
		result.Total++
		excelRow := i + 1
		deptCode := cell(row, 0)
		if deptCode == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "院系编码", Message: "院系编码不能为空"})
			continue
		}
		name := cell(row, 1)
		if name == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "专业名称", Message: "专业名称不能为空"})
			continue
		}
		req := &dto.MajorRequest{Name: name, Code: cell(row, 2)}
		if err := s.org.UpsertMajor(deptCode, req); err != nil {
			failRow(result, excelRow, "院系编码", err)
			continue
		}
		result.Success++
	}
	return result, nil
}

// ImportGrades 导入年级，按入学年份 upsert。
func (s *ImportService) ImportGrades(r io.Reader) (*dto.ImportResult, error) {
	rows, err := readRows(r)
	if err != nil {
		return nil, err
	}
	result := newImportResult()
	if err := checkImportHeader(rows, gradeColumns, result); err != nil {
		return result, nil
	}
	for i, row := range rows {
		if i == 0 || isBlankRow(row) {
			continue
		}
		result.Total++
		excelRow := i + 1
		name := cell(row, 0)
		if name == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "年级名称", Message: "年级名称不能为空"})
			continue
		}
		year, yerr := parseIntCell(row, 1)
		if yerr != nil || year <= 0 {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "入学年份", Message: "入学年份必须为正整数"})
			continue
		}
		req := &dto.GradeRequest{Name: name, Year: year}
		if err := s.org.UpsertGrade(req); err != nil {
			failRow(result, excelRow, "入学年份", err)
			continue
		}
		result.Success++
	}
	return result, nil
}

// ImportClasses 导入班级，按院系编码 + 班级名称 upsert。
func (s *ImportService) ImportClasses(r io.Reader) (*dto.ImportResult, error) {
	rows, err := readRows(r)
	if err != nil {
		return nil, err
	}
	result := newImportResult()
	if err := checkImportHeader(rows, classColumns, result); err != nil {
		return result, nil
	}
	for i, row := range rows {
		if i == 0 || isBlankRow(row) {
			continue
		}
		result.Total++
		excelRow := i + 1
		deptCode := cell(row, 0)
		if deptCode == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "院系编码", Message: "院系编码不能为空"})
			continue
		}
		name := cell(row, 3)
		if name == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "班级名称", Message: "班级名称不能为空"})
			continue
		}
		yearStr := cell(row, 2)
		var year int
		if yearStr != "" {
			var yerr error
			year, yerr = parseIntCell(row, 2)
			if yerr != nil || year <= 0 {
				result.Fail(dto.ImportRowError{Row: excelRow, Column: "入学年份", Message: "入学年份必须为正整数（可留空）"})
				continue
			}
		}
		staffNo := cell(row, 4)
		if staffNo == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "教工号", Message: "教工号不能为空"})
			continue
		}
		in := &ClassImportInput{
			DeptCode:  deptCode,
			MajorCode: cell(row, 1),
			GradeYear: year,
			Name:      name,
			StaffNo:   staffNo,
		}
		if err := s.org.UpsertClass(in); err != nil {
			failRow(result, excelRow, "教工号", err)
			continue
		}
		result.Success++
	}
	return result, nil
}

// Export 导出 Excel 数据（组织机构或与导入模板列一致的业务数据）。
func (s *ImportService) Export(kind string) ([]byte, string, error) {
	switch kind {
	case ImportTypeDepartments:
		return s.exportDepartments()
	case ImportTypeMajors:
		return s.exportMajors()
	case ImportTypeGrades:
		return s.exportGrades()
	case ImportTypeClasses:
		return s.exportClasses()
	case ImportTypeAdvisors:
		return s.ExportAdvisors()
	default:
		return nil, "", NewValidationError("不支持的导出类型")
	}
}

// ExportStudents 导出学生信息（列与导入模板一致；支持列表同款筛选，不分页）。
// 内部 code/ID 在导出时转换为中文名称（民族、政治面貌、院系、专业、班级）。
func (s *ImportService) ExportStudents(f repository.StudentFilter) ([]byte, string, error) {
	items, err := s.stu.ExportList(f)
	if err != nil {
		return nil, "", err
	}
	nationLabels, err := s.buildDictCodeToLabel("nation")
	if err != nil {
		return nil, "", err
	}
	politicalLabels, err := s.buildDictCodeToLabel("political_status")
	if err != nil {
		return nil, "", err
	}
	deptNames, majorNames, classNames, err := s.buildOrgIDToNameMaps()
	if err != nil {
		return nil, "", err
	}

	rows := make([][]any, 0, len(items))
	for i := range items {
		st := items[i]
		rows = append(rows, []any{
			st.StudentNo,
			st.Name,
			st.Gender,
			st.IDCard,
			st.Phone,
			labelOrCode(nationLabels, st.Nation),
			labelOrCode(politicalLabels, st.PoliticalStatus),
			deptNames[st.DeptID],
			majorNames[st.MajorID],
			classNames[st.ClassID],
			formatDate(st.Birth),
			formatDate(st.EnrollTime),
		})
	}
	return writeXlsx(studentColumns, rows, "students_export.xlsx")
}

// labelOrCode 字典 code -> label，未命中时回退原值，避免丢失数据。
func labelOrCode(m map[string]string, code string) string {
	code = strings.TrimSpace(code)
	if code == "" {
		return ""
	}
	if label, ok := m[code]; ok {
		return label
	}
	return code
}

func formatDate(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format(dto.DateLayout)
}

func (s *ImportService) exportDepartments() ([]byte, string, error) {
	items, err := s.org.ListDepartments()
	if err != nil {
		return nil, "", err
	}
	rows := make([][]any, 0, len(items))
	for i := range items {
		d := items[i]
		rows = append(rows, []any{d.Name, d.Code})
	}
	return writeXlsx(departmentColumns, rows, "departments_export.xlsx")
}

func (s *ImportService) exportMajors() ([]byte, string, error) {
	depts, err := s.org.ListDepartments()
	if err != nil {
		return nil, "", err
	}
	deptCode := map[uint]string{}
	for i := range depts {
		deptCode[depts[i].ID] = depts[i].Code
	}
	items, err := s.org.ListMajors(0)
	if err != nil {
		return nil, "", err
	}
	rows := make([][]any, 0, len(items))
	for i := range items {
		m := items[i]
		rows = append(rows, []any{deptCode[m.DeptID], m.Name, m.Code})
	}
	return writeXlsx(majorColumns, rows, "majors_export.xlsx")
}

func (s *ImportService) exportGrades() ([]byte, string, error) {
	items, err := s.org.ListGrades()
	if err != nil {
		return nil, "", err
	}
	rows := make([][]any, 0, len(items))
	for i := range items {
		g := items[i]
		rows = append(rows, []any{g.Name, g.Year})
	}
	return writeXlsx(gradeColumns, rows, "grades_export.xlsx")
}

func (s *ImportService) exportClasses() ([]byte, string, error) {
	depts, err := s.org.ListDepartments()
	if err != nil {
		return nil, "", err
	}
	deptCode := map[uint]string{}
	for i := range depts {
		deptCode[depts[i].ID] = depts[i].Code
	}
	majors, err := s.org.ListMajors(0)
	if err != nil {
		return nil, "", err
	}
	majorCode := map[uint]string{}
	for i := range majors {
		majorCode[majors[i].ID] = majors[i].Code
	}
	grades, err := s.org.ListGrades()
	if err != nil {
		return nil, "", err
	}
	gradeYear := map[uint]int{}
	for i := range grades {
		gradeYear[grades[i].ID] = grades[i].Year
	}

	items, err := s.org.ListClasses(0, 0, 0)
	if err != nil {
		return nil, "", err
	}

	rows := make([][]any, 0, len(items))
	for i := range items {
		c := items[i]
		year := any("")
		if c.GradeID > 0 {
			year = gradeYear[c.GradeID]
		}
		rows = append(rows, []any{
			deptCode[c.DeptID],
			majorCode[c.MajorID],
			year,
			c.Name,
			c.StaffNo,
		})
	}
	return writeXlsx(classColumns, rows, "classes_export.xlsx")
}

// ImportAdvisors 导入班主任名册。一行一位老师；班级名称可选，须已在班级管理中存在。
func (s *ImportService) ImportAdvisors(r io.Reader) (*dto.ImportResult, error) {
	rows, err := readRows(r)
	if err != nil {
		return nil, err
	}
	result := newImportResult()
	if err := checkImportHeader(rows, advisorColumns, result); err != nil {
		return result, nil
	}
	for i, row := range rows {
		if i == 0 || isBlankRow(row) {
			continue
		}
		result.Total++
		excelRow := i + 1
		deptKey := cell(row, 0)
		staffNo := cell(row, 1)
		name := cell(row, 2)
		phone := cell(row, 3)
		classRaw := cell(row, 4)
		if staffNo == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "教工号", Message: "教工号不能为空"})
			continue
		}
		if name == "" {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "姓名", Message: "姓名不能为空"})
			continue
		}
		dept, err := s.advisor.ResolveDepartment(deptKey)
		if err != nil {
			failRow(result, excelRow, "系部", err)
			continue
		}
		classNames := splitAdvisorClassNames(classRaw)
		if classRaw != "" && len(classNames) == 0 {
			result.Fail(dto.ImportRowError{Row: excelRow, Column: "班级名称", Message: "班级名称无效"})
			continue
		}
		var classIDs []uint
		for _, cn := range classNames {
			c, cerr := s.advisor.ResolveExistingClass(dept.ID, cn)
			if cerr != nil {
				failRow(result, excelRow, "班级名称", cerr)
				classIDs = nil
				break
			}
			classIDs = append(classIDs, c.ID)
		}
		if classRaw != "" && len(classIDs) == 0 {
			continue
		}
		if err := s.advisor.UpsertImported(dept.ID, staffNo, name, phone, classIDs); err != nil {
			failRow(result, excelRow, "教工号", err)
			continue
		}
		result.Success++
	}
	return result, nil
}

func splitAdvisorClassNames(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	replacer := strings.NewReplacer("，", ",", "、", ",", "；", ",", ";", ",", " ", ",")
	parts := strings.Split(replacer.Replace(raw), ",")
	out := make([]string, 0, len(parts))
	seen := map[string]struct{}{}
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		out = append(out, p)
	}
	return out
}

// ExportAdvisors 导出班主任（一班一行，便于再导入）。
func (s *ImportService) ExportAdvisors() ([]byte, string, error) {
	items, err := s.advisor.List(repository.AdvisorFilter{})
	if err != nil {
		return nil, "", err
	}
	classMeta := map[uint]model.Class{}
	classes, err := s.orgRepo.ListClasses(repository.ClassFilter{})
	if err != nil {
		return nil, "", err
	}
	for i := range classes {
		classMeta[classes[i].ID] = classes[i]
	}
	majors, err := s.orgRepo.ListMajors(0)
	if err != nil {
		return nil, "", err
	}
	majorNames := map[uint]string{}
	for i := range majors {
		majorNames[majors[i].ID] = majors[i].Name
	}
	grades, err := s.orgRepo.ListGrades()
	if err != nil {
		return nil, "", err
	}
	gradeNames := map[uint]string{}
	for i := range grades {
		gradeNames[grades[i].ID] = grades[i].Name
	}

	var rows [][]any
	for _, a := range items.Items {
		if len(a.Classes) == 0 {
			rows = append(rows, []any{a.DeptName, a.StaffNo, a.Name, a.Phone, "", "", ""})
			continue
		}
		for _, cls := range a.Classes {
			c := classMeta[cls.ID]
			rows = append(rows, []any{
				a.DeptName, a.StaffNo, a.Name, a.Phone, cls.Name,
				majorNames[c.MajorID], gradeNames[c.GradeID],
			})
		}
	}
	return writeXlsx(advisorColumns, rows, "advisors_export.xlsx")
}

// writeXlsx 写入表头 + 数据行并返回 xlsx 字节。
func writeXlsx(columns []string, rows [][]any, filename string) ([]byte, string, error) {
	f := excelize.NewFile()
	defer f.Close()
	sheet := "Sheet1"
	header := make([]any, len(columns))
	for i, c := range columns {
		header[i] = c
	}
	if err := f.SetSheetRow(sheet, "A1", &header); err != nil {
		return nil, "", err
	}
	for i, row := range rows {
		cellRef, _ := excelize.CoordinatesToCellName(1, i+2)
		if err := f.SetSheetRow(sheet, cellRef, &row); err != nil {
			return nil, "", err
		}
	}
	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, "", err
	}
	return buf.Bytes(), filename, nil
}

// ===== 行解析辅助 =====

func newImportResult() *dto.ImportResult {
	return &dto.ImportResult{Errors: []dto.ImportRowError{}}
}

// checkImportHeader 校验表头是否与模板一致；失败时写入 result 第 1 行错误并返回 err。
func checkImportHeader(rows [][]string, expected []string, result *dto.ImportResult) error {
	if len(rows) == 0 {
		msg := "文件为空，请使用系统提供的导入模板"
		result.Fail(dto.ImportRowError{Row: 1, Column: "表头", Message: msg})
		return errors.New(msg)
	}
	header := rows[0]
	for i, exp := range expected {
		got := ""
		if i < len(header) {
			got = strings.TrimSpace(header[i])
		}
		if got != exp {
			msg := fmt.Sprintf("表头第 %d 列应为「%s」，当前为「%s」；请下载最新模板", i+1, exp, got)
			result.Fail(dto.ImportRowError{Row: 1, Column: "表头", Message: msg})
			return errors.New(msg)
		}
	}
	return nil
}

func failRow(result *dto.ImportResult, excelRow int, column string, err error) {
	e := toRowError(excelRow, err)
	if column != "" && e.Column == "" {
		e.Column = column
	}
	result.Fail(e)
}

func isBlankRow(row []string) bool {
	for _, c := range row {
		if strings.TrimSpace(c) != "" {
			return false
		}
	}
	return true
}

func parseIntCell(row []string, idx int) (int, error) {
	v := cell(row, idx)
	if v == "" {
		return 0, nil
	}
	return strconv.Atoi(v)
}

// toRowError 将业务/校验错误转换为行级回显（无法定位具体列时 Column 留空）。
func toRowError(excelRow int, err error) dto.ImportRowError {
	var ve *ValidationError
	switch {
	case errors.As(err, &ve):
		return dto.ImportRowError{Row: excelRow, Message: ve.Msg}
	case errors.Is(err, ErrDuplicate):
		return dto.ImportRowError{Row: excelRow, Message: "记录已存在"}
	case errors.Is(err, ErrInvalidRef):
		return dto.ImportRowError{Row: excelRow, Message: "关联数据不存在"}
	default:
		return dto.ImportRowError{Row: excelRow, Message: "导入失败：" + err.Error()}
	}
}
