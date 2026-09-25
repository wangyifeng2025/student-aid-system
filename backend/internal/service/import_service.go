package service

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/password"
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
	ImportTypeUsers         = "users"
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
var userColumns = []string{"用户名", "姓名", "角色", "手机号", "所属院系编码", "状态"}

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
	case ImportTypeUsers:
		columns = userColumns
		example = []any{"T2024001", "李老师", "classadvisor", "13800001111", "CS", "启用"}
		filename = "users_template.xlsx"
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

// normalizeExcelIdentifier 把教工号/电话从 Excel 数字或科学计数法还原为整数字符串。
func normalizeExcelIdentifier(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	s = strings.TrimSuffix(s, ".0")
	if strings.ContainsAny(s, "eE") {
		if f, err := strconv.ParseFloat(s, 64); err == nil && f > 0 {
			return strconv.FormatInt(int64(f+0.5), 10)
		}
	}
	return s
}

// ImportStudents 导入录取/新生名单，按学号增量 upsert，逐行回显错误。
// Excel 中民族、政治面貌填写中文名称；院系、专业、班级填写名称，由本函数
// 在导入前查字典与组织机构转换为内部 code/ID。
func (s *ImportService) ImportStudents(r io.Reader) (*dto.ImportResult, error) {
	rows, err := readRows(r)
	if err != nil {
		return nil, err
	}
	sess := newImportSession(studentColumns, "学生导入失败.xlsx")
	result := sess.result
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
			sess.fail(excelRow, "学号", "学号不能为空", row)
			continue
		}
		name := cell(row, 1)
		if name == "" {
			sess.fail(excelRow, "姓名", "姓名不能为空", row)
			continue
		}
		gender := cell(row, 2)
		if gender == "" {
			sess.fail(excelRow, "性别", "性别不能为空", row)
			continue
		}
		if gender != "男" && gender != "女" {
			sess.fail(excelRow, "性别", "性别只能为“男”或“女”", row)
			continue
		}
		idCard := strings.ToUpper(strings.TrimSpace(cell(row, 3)))
		if idCard == "" {
			sess.fail(excelRow, "身份证号", "身份证号不能为空", row)
			continue
		}

		// 民族：名称 -> code（可空）
		nationName := cell(row, 5)
		nationCode := ""
		if nationName != "" {
			code, ok := nationMap[nationName]
			if !ok {
				sess.fail(excelRow, "民族", "民族「"+nationName+"」不存在，请填写字典中的名称", row)
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
				sess.fail(excelRow, "政治面貌", "政治面貌「"+politicalName+"」不存在，请填写字典中的名称", row)
				continue
			}
			politicalCode = code
		}

		// 院系/专业/班级：名称 -> ID（必填）
		deptName := cell(row, 7)
		if deptName == "" {
			sess.fail(excelRow, "院系", "院系不能为空", row)
			continue
		}
		dept, ok := deptByName[deptName]
		if !ok {
			sess.fail(excelRow, "院系", "院系「"+deptName+"」不存在", row)
			continue
		}
		majorName := cell(row, 8)
		if majorName == "" {
			sess.fail(excelRow, "专业", "专业不能为空", row)
			continue
		}
		major, ok := majorByDept[dept.ID][majorName]
		if !ok {
			sess.fail(excelRow, "专业", "院系「"+deptName+"」下不存在专业「"+majorName+"」", row)
			continue
		}
		className := cell(row, 9)
		if className == "" {
			sess.fail(excelRow, "班级", "班级不能为空", row)
			continue
		}
		class, ok := classByDept[dept.ID][className]
		if !ok {
			sess.fail(excelRow, "班级", "院系「"+deptName+"」下不存在班级「"+className+"」", row)
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
			sess.failErr(excelRow, "", err, row)
			continue
		}
		result.Success++
	}
	return sess.done(), nil
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
	classes, _, err := s.orgRepo.ListClasses(repository.ClassFilter{})
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
	sess := newImportSession(specialGroupColumns, "重点人群导入失败.xlsx")
	result := sess.result
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
			sess.fail(excelRow, "学号", "学号与身份证号至少填写一项", row)
			continue
		}
		sgType := cell(row, 3)
		if sgType == "" {
			sess.fail(excelRow, "类型(编码)", "类型(编码)不能为空", row)
			continue
		}
		year, yerr := parseIntCell(row, 6)
		if yerr != nil || year <= 0 {
			sess.fail(excelRow, "年度", "年度必须为正整数", row)
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
			sess.failErr(excelRow, "", err, row)
			continue
		}
		result.Success++
	}
	return sess.done(), nil
}

// ImportDepartments 导入院系，按编码 upsert。
func (s *ImportService) ImportDepartments(r io.Reader) (*dto.ImportResult, error) {
	rows, err := readRows(r)
	if err != nil {
		return nil, err
	}
	sess := newImportSession(departmentColumns, "院系导入失败.xlsx")
	result := sess.result
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
			sess.fail(excelRow, "院系名称", "院系名称不能为空", row)
			continue
		}
		req := &dto.DepartmentRequest{Name: name, Code: cell(row, 1)}
		if err := s.org.UpsertDepartment(req); err != nil {
			sess.failErr(excelRow, "院系名称", err, row)
			continue
		}
		result.Success++
	}
	return sess.done(), nil
}

// ImportMajors 导入专业，按院系编码 + 专业编码/名称 upsert。
func (s *ImportService) ImportMajors(r io.Reader) (*dto.ImportResult, error) {
	rows, err := readRows(r)
	if err != nil {
		return nil, err
	}
	sess := newImportSession(majorColumns, "专业导入失败.xlsx")
	result := sess.result
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
			sess.fail(excelRow, "院系编码", "院系编码不能为空", row)
			continue
		}
		name := cell(row, 1)
		if name == "" {
			sess.fail(excelRow, "专业名称", "专业名称不能为空", row)
			continue
		}
		req := &dto.MajorRequest{Name: name, Code: cell(row, 2)}
		if err := s.org.UpsertMajor(deptCode, req); err != nil {
			sess.failErr(excelRow, "院系编码", err, row)
			continue
		}
		result.Success++
	}
	return sess.done(), nil
}

// ImportGrades 导入年级，按入学年份 upsert。
func (s *ImportService) ImportGrades(r io.Reader) (*dto.ImportResult, error) {
	rows, err := readRows(r)
	if err != nil {
		return nil, err
	}
	sess := newImportSession(gradeColumns, "年级导入失败.xlsx")
	result := sess.result
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
			sess.fail(excelRow, "年级名称", "年级名称不能为空", row)
			continue
		}
		year, yerr := parseIntCell(row, 1)
		if yerr != nil || year <= 0 {
			sess.fail(excelRow, "入学年份", "入学年份必须为正整数", row)
			continue
		}
		req := &dto.GradeRequest{Name: name, Year: year}
		if err := s.org.UpsertGrade(req); err != nil {
			sess.failErr(excelRow, "入学年份", err, row)
			continue
		}
		result.Success++
	}
	return sess.done(), nil
}

// ImportClasses 导入班级，按院系编码 + 班级名称 upsert。
func (s *ImportService) ImportClasses(r io.Reader) (*dto.ImportResult, error) {
	rows, err := readRows(r)
	if err != nil {
		return nil, err
	}
	sess := newImportSession(classColumns, "班级导入失败.xlsx")
	result := sess.result
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
			sess.fail(excelRow, "院系编码", "院系编码不能为空", row)
			continue
		}
		name := cell(row, 3)
		if name == "" {
			sess.fail(excelRow, "班级名称", "班级名称不能为空", row)
			continue
		}
		yearStr := cell(row, 2)
		var year int
		if yearStr != "" {
			var yerr error
			year, yerr = parseIntCell(row, 2)
			if yerr != nil || year <= 0 {
				sess.fail(excelRow, "入学年份", "入学年份必须为正整数（可留空）", row)
				continue
			}
		}
		staffNo := cell(row, 4)
		if staffNo == "" {
			sess.fail(excelRow, "教工号", "教工号不能为空", row)
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
			sess.failErr(excelRow, "教工号", err, row)
			continue
		}
		result.Success++
	}
	return sess.done(), nil
}

// Export 导出 Excel 数据（组织机构或与导入模板列一致的业务数据）。
func (s *ImportService) Export(kind string, ids []uint) ([]byte, string, error) {
	switch kind {
	case ImportTypeDepartments:
		return s.exportDepartments(ids)
	case ImportTypeMajors:
		return s.exportMajors(ids)
	case ImportTypeGrades:
		return s.exportGrades(ids)
	case ImportTypeClasses:
		return s.exportClasses(ids)
	case ImportTypeAdvisors:
		return s.ExportAdvisors(repository.AdvisorFilter{IDs: ids})
	default:
		return nil, "", NewValidationError("不支持的导出类型")
	}
}

// ExportStudents 导出学生信息（列与导入模板一致；支持列表同款筛选，不分页）。
// 内部 code/ID 在导出时转换为中文名称（民族、政治面貌、院系、专业、班级）。
func (s *ImportService) ExportStudents(f repository.StudentFilter, actor rbac.Actor) ([]byte, string, error) {
	items, err := s.stu.ExportList(f, actor)
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

// specialGroupExportColumns 前 7 列与导入模板一致，后面补充类型名称和匹配到的学籍。
var specialGroupExportColumns = []string{
	"学号", "身份证号", "姓名", "类型(编码)", "来源", "批次", "年度", "类型", "专业", "班级",
}

// ExportSpecialGroups 导出重点人群名单（支持列表同款筛选与勾选，不分页）。
func (s *ImportService) ExportSpecialGroups(f repository.SpecialGroupFilter) ([]byte, string, error) {
	f.Page = 1
	f.PageSize = 0
	res, err := s.sg.List(f)
	if err != nil {
		return nil, "", err
	}
	typeLabels, err := s.buildDictCodeToLabel("special_group_type")
	if err != nil {
		return nil, "", err
	}
	rows := make([][]any, 0, len(res.Items))
	for i := range res.Items {
		sg := res.Items[i]
		rows = append(rows, []any{
			sg.StudentNo,
			sg.IDCard,
			sg.Name,
			sg.Type,
			sg.Source,
			sg.Batch,
			sg.Year,
			labelOrCode(typeLabels, sg.Type),
			sg.MajorName,
			sg.ClassName,
		})
	}
	return writeXlsx(specialGroupExportColumns, rows, "special_groups_export.xlsx")
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

func (s *ImportService) exportDepartments(ids []uint) ([]byte, string, error) {
	items, err := s.org.ListDepartments()
	if err != nil {
		return nil, "", err
	}
	idset := toIDSet(ids)
	rows := make([][]any, 0, len(items))
	for i := range items {
		d := items[i]
		if idset != nil && !idset[d.ID] {
			continue
		}
		rows = append(rows, []any{d.Name, d.Code})
	}
	return writeXlsx(departmentColumns, rows, "departments_export.xlsx")
}

func (s *ImportService) exportMajors(ids []uint) ([]byte, string, error) {
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
	idset := toIDSet(ids)
	rows := make([][]any, 0, len(items))
	for i := range items {
		m := items[i]
		if idset != nil && !idset[m.ID] {
			continue
		}
		rows = append(rows, []any{deptCode[m.DeptID], m.Name, m.Code})
	}
	return writeXlsx(majorColumns, rows, "majors_export.xlsx")
}

func (s *ImportService) exportGrades(ids []uint) ([]byte, string, error) {
	items, err := s.org.ListGrades()
	if err != nil {
		return nil, "", err
	}
	idset := toIDSet(ids)
	rows := make([][]any, 0, len(items))
	for i := range items {
		g := items[i]
		if idset != nil && !idset[g.ID] {
			continue
		}
		rows = append(rows, []any{g.Name, g.Year})
	}
	return writeXlsx(gradeColumns, rows, "grades_export.xlsx")
}

func (s *ImportService) exportClasses(ids []uint) ([]byte, string, error) {
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

	items, _, err := s.org.ListClasses(repository.ClassFilter{})
	if err != nil {
		return nil, "", err
	}

	idset := toIDSet(ids)
	rows := make([][]any, 0, len(items))
	for i := range items {
		c := items[i]
		if idset != nil && !idset[c.ID] {
			continue
		}
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

// toIDSet 将 ID 列表转为集合用于快速过滤；nil 表示不限制。
func toIDSet(ids []uint) map[uint]bool {
	if len(ids) == 0 {
		return nil
	}
	m := make(map[uint]bool, len(ids))
	for _, id := range ids {
		if id > 0 {
			m[id] = true
		}
	}
	return m
}

// ImportAdvisors 导入班主任名册。一行一位老师；班级名称可选，须已在班级管理中存在。
func (s *ImportService) ImportAdvisors(r io.Reader) (*dto.ImportResult, error) {
	rows, err := readRows(r)
	if err != nil {
		return nil, err
	}
	sess := newImportSession(advisorColumns, "班主任导入失败.xlsx")
	result := sess.result
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
		staffNo := normalizeExcelIdentifier(cell(row, 1))
		name := cell(row, 2)
		phone := normalizeExcelIdentifier(cell(row, 3))
		classRaw := cell(row, 4)
		if staffNo == "" {
			sess.fail(excelRow, "教工号", "教工号不能为空", row)
			continue
		}
		if name == "" {
			sess.fail(excelRow, "姓名", "姓名不能为空", row)
			continue
		}
		dept, err := s.advisor.ResolveDepartment(deptKey)
		if err != nil {
			sess.failErr(excelRow, "系部", err, row)
			continue
		}
		classNames := splitAdvisorClassNames(classRaw)
		if classRaw != "" && len(classNames) == 0 {
			sess.fail(excelRow, "班级名称", "班级名称无效", row)
			continue
		}
		var classIDs []uint
		for _, cn := range classNames {
			c, cerr := s.advisor.ResolveExistingClass(dept.ID, cn)
			if cerr != nil {
				sess.failErr(excelRow, "班级名称", cerr, row)
				classIDs = nil
				break
			}
			classIDs = append(classIDs, c.ID)
		}
		if classRaw != "" && len(classIDs) == 0 {
			continue
		}
		if err := s.advisor.UpsertImported(dept.ID, staffNo, name, phone, classIDs); err != nil {
			sess.failErr(excelRow, "教工号", err, row)
			continue
		}
		result.Success++
	}
	return sess.done(), nil
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
func (s *ImportService) ExportAdvisors(f repository.AdvisorFilter) ([]byte, string, error) {
	items, err := s.advisor.List(f)
	if err != nil {
		return nil, "", err
	}
	classMeta := map[uint]model.Class{}
	classes, _, err := s.orgRepo.ListClasses(repository.ClassFilter{})
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

// ExportUsers 导出用户（列与导入模板一致；支持筛选与勾选）。
func (s *ImportService) ExportUsers(f repository.UserFilter) ([]byte, string, error) {
	// 导出不分页
	f.Page = 0
	f.PageSize = 0
	items, _, err := s.user.ListUsers(f)
	if err != nil {
		return nil, "", err
	}
	depts, err := s.orgRepo.ListDepartments()
	if err != nil {
		return nil, "", err
	}
	deptCode := map[uint]string{}
	for i := range depts {
		deptCode[depts[i].ID] = depts[i].Code
	}
	rows := make([][]any, 0, len(items))
	for i := range items {
		u := items[i]
		dept := ""
		if u.DeptID != nil {
			dept = deptCode[*u.DeptID]
		}
		status := "禁用"
		if u.Status == 1 {
			status = "启用"
		}
		rows = append(rows, []any{
			u.Username,
			u.RealName,
			string(u.Role),
			u.Phone,
			dept,
			status,
		})
	}
	return writeXlsx(userColumns, rows, "users_export.xlsx")
}

// ImportUsers 导入用户。模板列：用户名*、姓名*、角色*、手机号、所属院系编码、状态。
// 学生账号建议通过学生信息维护自动创建，此处主要用于批量导入审核角色账号。
// 班主任 / 系管理员 / 学院管理员必须带手机号，初始密码为 Adv / Dept / Aid + 手机后 6 位。
// 已存在的用户名会跳过（不覆盖），避免误改密码。
func (s *ImportService) ImportUsers(r io.Reader) (*dto.ImportResult, error) {
	rows, err := readRows(r)
	if err != nil {
		return nil, err
	}
	sess := newImportSession(userColumns, "用户导入失败.xlsx")
	result := sess.result
	if err := checkImportHeader(rows, userColumns, result); err != nil {
		return result, nil
	}
	depts, err := s.orgRepo.ListDepartments()
	if err != nil {
		return nil, err
	}
	deptByCode := map[string]uint{}
	for i := range depts {
		deptByCode[depts[i].Code] = depts[i].ID
	}
	for i, row := range rows {
		if i == 0 || isBlankRow(row) {
			continue
		}
		result.Total++
		excelRow := i + 1
		username := normalizeExcelIdentifier(cell(row, 0))
		name := cell(row, 1)
		role := strings.TrimSpace(cell(row, 2))
		phone := normalizeExcelIdentifier(cell(row, 3))
		deptCode := strings.TrimSpace(cell(row, 4))
		statusRaw := strings.TrimSpace(cell(row, 5))

		if username == "" {
			sess.fail(excelRow, "用户名", "用户名不能为空", row)
			continue
		}
		if name == "" {
			sess.fail(excelRow, "姓名", "姓名不能为空", row)
			continue
		}
		if !model.IsValidRole(role) {
			sess.fail(excelRow, "角色", "角色取值无效", row)
			continue
		}
		status := 1
		if statusRaw != "" {
			if statusRaw == "启用" || statusRaw == "1" {
				status = 1
			} else if statusRaw == "禁用" || statusRaw == "0" {
				status = 0
			} else {
				sess.fail(excelRow, "状态", "状态取值无效（启用/禁用）", row)
				continue
			}
		}
		var deptID *uint
		if deptCode != "" {
			id, ok := deptByCode[deptCode]
			if !ok {
				sess.fail(excelRow, "所属院系编码", "院系编码不存在", row)
				continue
			}
			deptID = &id
		}
		// 已存在则跳过（不覆盖密码与角色）
		exists, err := s.user.UsernameExists(username, 0)
		if err != nil {
			sess.failErr(excelRow, "用户名", err, row)
			continue
		}
		if exists {
			sess.fail(excelRow, "用户名", "用户名已存在，跳过", row)
			continue
		}
		pwd, perr := initialImportUserPassword(model.Role(role), username, phone)
		if perr != nil {
			sess.failErr(excelRow, "手机号", perr, row)
			continue
		}
		hash, err := password.Hash(pwd)
		if err != nil {
			sess.failErr(excelRow, "用户名", err, row)
			continue
		}
		u := &model.User{
			Username:     username,
			PasswordHash: hash,
			RealName:     name,
			Role:         model.Role(role),
			Phone:        phone,
			DeptID:       deptID,
			Status:       status,
		}
		if err := s.user.Create(u); err != nil {
			sess.failErr(excelRow, "用户名", err, row)
			continue
		}
		result.Success++
	}
	return sess.done(), nil
}

// initialImportUserPassword 导入用户初始密码。
// 班主任 / 系管理员 / 学院管理员：Adv / Dept / Aid + 手机号后 6 位；
// 其余角色仍用 U + 用户名后 6 位（系统管理员等须事后改密）。
func initialImportUserPassword(role model.Role, username, phone string) (string, error) {
	if usesPhonePasswordRule(role) {
		return roleInitialPassword(role, phone)
	}
	s := username
	if len(s) > 6 {
		s = s[len(s)-6:]
	}
	return "U" + s, nil
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

const importErrorReasonColumn = "错误原因"

type importSession struct {
	result   *dto.ImportResult
	columns  []string
	filename string
}

func newImportSession(columns []string, filename string) *importSession {
	return &importSession{
		result:   newImportResult(),
		columns:  columns,
		filename: filename,
	}
}

func (s *importSession) fail(excelRow int, column, message string, row []string) {
	s.result.Fail(dto.ImportRowError{
		Row:     excelRow,
		Column:  column,
		Message: message,
		Values:  rowCells(row, len(s.columns)),
	})
}

func (s *importSession) failErr(excelRow int, column string, err error, row []string) {
	e := toRowError(excelRow, err)
	if column != "" && e.Column == "" {
		e.Column = column
	}
	s.fail(excelRow, e.Column, e.Message, row)
}

func (s *importSession) done() *dto.ImportResult {
	attachImportErrorFile(s.result, s.columns, s.filename)
	return s.result
}

func rowCells(row []string, n int) []string {
	out := make([]string, n)
	for i := 0; i < n; i++ {
		out[i] = cell(row, i)
	}
	return out
}

// attachImportErrorFile 把失败数据行写成与导入模板同列的 xlsx（末列附错误原因），便于修订后再导入。
func attachImportErrorFile(result *dto.ImportResult, columns []string, filename string) {
	if result == nil || len(columns) == 0 {
		return
	}
	rows := make([][]any, 0, len(result.Errors))
	for _, e := range result.Errors {
		if len(e.Values) == 0 {
			continue
		}
		row := make([]any, 0, len(columns)+1)
		for i := range columns {
			v := ""
			if i < len(e.Values) {
				v = e.Values[i]
			}
			row = append(row, v)
		}
		reason := e.Message
		if col := strings.TrimSpace(e.Column); col != "" && col != "表头" {
			reason = col + "：" + e.Message
		}
		row = append(row, reason)
		rows = append(rows, row)
	}
	if len(rows) == 0 {
		return
	}
	header := make([]string, 0, len(columns)+1)
	header = append(header, columns...)
	header = append(header, importErrorReasonColumn)
	data, name, err := writeXlsx(header, rows, filename)
	if err != nil {
		return
	}
	result.ErrorFile = base64.StdEncoding.EncodeToString(data)
	result.ErrorFileName = name
}

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
