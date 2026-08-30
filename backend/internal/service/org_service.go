package service

import (
	"fmt"
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"gorm.io/gorm"
)

// OrgService 组织机构（院系/专业/年级/班级）业务逻辑。
type OrgService struct {
	repo       *repository.OrgRepository
	advisors   *repository.AdvisorRepository
	advisorSvc *AdvisorService
}

func NewOrgService(db *gorm.DB) *OrgService {
	return &OrgService{
		repo:       repository.NewOrgRepository(db),
		advisors:   repository.NewAdvisorRepository(db),
		advisorSvc: NewAdvisorService(db),
	}
}

// ===== 院系 =====

func (s *OrgService) ListDepartments() ([]dto.DepartmentResponse, error) {
	items, err := s.repo.ListDepartments()
	if err != nil {
		return nil, err
	}
	return dto.ToDepartmentResponses(items), nil
}

func (s *OrgService) CreateDepartment(req *dto.DepartmentRequest) (*dto.DepartmentResponse, error) {
	if req.Code != "" {
		exists, err := s.repo.DepartmentCodeExists(req.Code, 0)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, ErrDuplicate
		}
	}
	d := &model.Department{Name: req.Name, Code: req.Code}
	if err := s.repo.CreateDepartment(d); err != nil {
		return nil, err
	}
	resp := dto.ToDepartmentResponse(d)
	return &resp, nil
}

func (s *OrgService) UpdateDepartment(id uint, req *dto.DepartmentRequest) (*dto.DepartmentResponse, error) {
	d, err := s.repo.FindDepartment(id)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if req.Code != "" {
		exists, err := s.repo.DepartmentCodeExists(req.Code, id)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, ErrDuplicate
		}
	}
	d.Name = req.Name
	d.Code = req.Code
	if err := s.repo.SaveDepartment(d); err != nil {
		return nil, err
	}
	resp := dto.ToDepartmentResponse(d)
	return &resp, nil
}

func (s *OrgService) DeleteDepartment(id uint) error {
	if _, err := s.repo.FindDepartment(id); err != nil {
		if repository.IsNotFound(err) {
			return ErrNotFound
		}
		return err
	}
	// 院系下存在专业或班级时禁止删除，避免产生孤儿数据。
	majors, err := s.repo.CountMajorsByDept(id)
	if err != nil {
		return err
	}
	classes, err := s.repo.CountClassesByDept(id)
	if err != nil {
		return err
	}
	if majors > 0 || classes > 0 {
		return ErrInUse
	}
	return s.repo.DeleteDepartment(id)
}

// ===== 专业 =====

func (s *OrgService) ListMajors(deptID uint) ([]dto.MajorResponse, error) {
	items, err := s.repo.ListMajors(deptID)
	if err != nil {
		return nil, err
	}
	return dto.ToMajorResponses(items), nil
}

func (s *OrgService) CreateMajor(req *dto.MajorRequest) (*dto.MajorResponse, error) {
	if err := s.requireDepartment(req.DeptID); err != nil {
		return nil, err
	}
	m := &model.Major{DeptID: req.DeptID, Name: req.Name, Code: req.Code}
	if err := s.repo.CreateMajor(m); err != nil {
		return nil, err
	}
	resp := dto.ToMajorResponse(m)
	return &resp, nil
}

func (s *OrgService) UpdateMajor(id uint, req *dto.MajorRequest) (*dto.MajorResponse, error) {
	m, err := s.repo.FindMajor(id)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := s.requireDepartment(req.DeptID); err != nil {
		return nil, err
	}
	m.DeptID = req.DeptID
	m.Name = req.Name
	m.Code = req.Code
	if err := s.repo.SaveMajor(m); err != nil {
		return nil, err
	}
	resp := dto.ToMajorResponse(m)
	return &resp, nil
}

func (s *OrgService) DeleteMajor(id uint) error {
	if _, err := s.repo.FindMajor(id); err != nil {
		if repository.IsNotFound(err) {
			return ErrNotFound
		}
		return err
	}
	classes, err := s.repo.CountClassesByMajor(id)
	if err != nil {
		return err
	}
	if classes > 0 {
		return ErrInUse
	}
	return s.repo.DeleteMajor(id)
}

// ===== 年级 =====

func (s *OrgService) ListGrades() ([]dto.GradeResponse, error) {
	items, err := s.repo.ListGrades()
	if err != nil {
		return nil, err
	}
	return dto.ToGradeResponses(items), nil
}

func (s *OrgService) CreateGrade(req *dto.GradeRequest) (*dto.GradeResponse, error) {
	g := &model.Grade{Name: req.Name, Year: req.Year}
	if err := s.repo.CreateGrade(g); err != nil {
		return nil, err
	}
	resp := dto.ToGradeResponse(g)
	return &resp, nil
}

func (s *OrgService) UpdateGrade(id uint, req *dto.GradeRequest) (*dto.GradeResponse, error) {
	g, err := s.repo.FindGrade(id)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	g.Name = req.Name
	g.Year = req.Year
	if err := s.repo.SaveGrade(g); err != nil {
		return nil, err
	}
	resp := dto.ToGradeResponse(g)
	return &resp, nil
}

func (s *OrgService) DeleteGrade(id uint) error {
	if _, err := s.repo.FindGrade(id); err != nil {
		if repository.IsNotFound(err) {
			return ErrNotFound
		}
		return err
	}
	classes, err := s.repo.CountClassesByGrade(id)
	if err != nil {
		return err
	}
	if classes > 0 {
		return ErrInUse
	}
	return s.repo.DeleteGrade(id)
}

// ===== 班级 =====

func (s *OrgService) ListClasses(deptID, majorID, gradeID uint) ([]dto.ClassResponse, error) {
	items, err := s.repo.ListClasses(repository.ClassFilter{DeptID: deptID, MajorID: majorID, GradeID: gradeID})
	if err != nil {
		return nil, err
	}
	return s.toClassResponses(items)
}

func (s *OrgService) CreateClass(req *dto.ClassRequest) (*dto.ClassResponse, error) {
	if err := s.validateClassRefs(req); err != nil {
		return nil, err
	}
	advisor, err := s.resolveClassAdvisor(req.DeptID, req)
	if err != nil {
		return nil, err
	}
	c := &model.Class{
		DeptID:  req.DeptID,
		MajorID: req.MajorID,
		GradeID: req.GradeID,
		Name:    req.Name,
	}
	if err := s.repo.CreateClass(c); err != nil {
		return nil, err
	}
	if err := s.advisorSvc.BindClass(advisor, c.ID); err != nil {
		return nil, err
	}
	if saved, err := s.repo.FindClass(c.ID); err == nil {
		c = saved
	}
	resp := dto.ToClassResponseWithAdvisor(c, advisor)
	return &resp, nil
}

func (s *OrgService) UpdateClass(id uint, req *dto.ClassRequest) (*dto.ClassResponse, error) {
	c, err := s.repo.FindClass(id)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := s.validateClassRefs(req); err != nil {
		return nil, err
	}
	advisor, err := s.resolveClassAdvisor(req.DeptID, req)
	if err != nil {
		return nil, err
	}
	c.DeptID = req.DeptID
	c.MajorID = req.MajorID
	c.GradeID = req.GradeID
	c.Name = req.Name
	if err := s.repo.SaveClass(c); err != nil {
		return nil, err
	}
	if err := s.advisorSvc.BindClass(advisor, c.ID); err != nil {
		return nil, err
	}
	if saved, err := s.repo.FindClass(c.ID); err == nil {
		c = saved
	}
	resp := dto.ToClassResponseWithAdvisor(c, advisor)
	return &resp, nil
}

func (s *OrgService) DeleteClass(id uint) error {
	if _, err := s.repo.FindClass(id); err != nil {
		if repository.IsNotFound(err) {
			return ErrNotFound
		}
		return err
	}
	students, err := s.repo.CountStudentsByClass(id)
	if err != nil {
		return err
	}
	if students > 0 {
		return ErrInUse
	}
	if err := s.advisors.UnlinkClass(id); err != nil {
		return err
	}
	return s.repo.DeleteClass(id)
}

// requireDepartment 校验院系存在。
func (s *OrgService) requireDepartment(deptID uint) error {
	exists, err := s.repo.DepartmentExists(deptID)
	if err != nil {
		return err
	}
	if !exists {
		return ErrInvalidRef
	}
	return nil
}

// validateClassRefs 校验班级关联的院系/专业/年级/班主任是否存在。
func (s *OrgService) validateClassRefs(req *dto.ClassRequest) error {
	if err := s.requireDepartment(req.DeptID); err != nil {
		return err
	}
	if req.MajorID > 0 {
		exists, err := s.repo.MajorExists(req.MajorID)
		if err != nil {
			return err
		}
		if !exists {
			return ErrInvalidRef
		}
	}
	if req.GradeID > 0 {
		exists, err := s.repo.GradeExists(req.GradeID)
		if err != nil {
			return err
		}
		if !exists {
			return ErrInvalidRef
		}
	}
	return nil
}

func (s *OrgService) resolveClassAdvisor(deptID uint, req *dto.ClassRequest) (*model.Advisor, error) {
	staffNo := strings.TrimSpace(req.StaffNo)
	if staffNo == "" {
		return nil, NewValidationError("教工号不能为空，请先维护班主任信息")
	}
	a, err := s.advisors.FindByStaffNo(staffNo, 0)
	if repository.IsNotFound(err) {
		return nil, NewValidationError("教工号不存在：" + staffNo)
	}
	if err != nil {
		return nil, err
	}
	if a.DeptID != deptID {
		return nil, NewValidationError("该班主任不属于所选院系")
	}
	return a, nil
}

func (s *OrgService) toClassResponses(items []model.Class) ([]dto.ClassResponse, error) {
	ids := make([]uint, 0, len(items))
	userIDs := make([]uint, 0)
	for i := range items {
		ids = append(ids, items[i].ID)
		if items[i].AdvisorID != nil && *items[i].AdvisorID > 0 {
			userIDs = append(userIDs, *items[i].AdvisorID)
		}
	}
	byClass, err := s.advisors.FindByClassIDs(ids)
	if err != nil {
		return nil, err
	}
	byUser, err := s.advisors.FindByUserIDs(userIDs)
	if err != nil {
		return nil, err
	}
	out := make([]dto.ClassResponse, 0, len(items))
	for i := range items {
		c := items[i]
		var a *model.Advisor
		if found, ok := byClass[c.ID]; ok {
			cp := found
			a = &cp
		} else if c.AdvisorID != nil {
			if found, ok := byUser[*c.AdvisorID]; ok {
				cp := found
				a = &cp
			}
		}
		out = append(out, dto.ToClassResponseWithAdvisor(&c, a))
	}
	return out, nil
}

// ===== 导入用 Upsert（按编码/名称幂等）=====

// UpsertDepartment 按院系编码 upsert；编码为空则始终新增。
func (s *OrgService) UpsertDepartment(req *dto.DepartmentRequest) error {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return NewValidationError("院系名称不能为空")
	}
	code := strings.TrimSpace(req.Code)
	if code != "" {
		existing, err := s.repo.FindDepartmentByCode(code)
		if err == nil {
			existing.Name = name
			return s.repo.SaveDepartment(existing)
		}
		if !repository.IsNotFound(err) {
			return err
		}
	}
	_, err := s.CreateDepartment(&dto.DepartmentRequest{Name: name, Code: code})
	return err
}

// UpsertMajor 按「院系编码 + 专业编码」或「院系编码 + 专业名称」upsert。
func (s *OrgService) UpsertMajor(deptCode string, req *dto.MajorRequest) error {
	deptCode = strings.TrimSpace(deptCode)
	if deptCode == "" {
		return NewValidationError("院系编码不能为空")
	}
	dept, err := s.repo.FindDepartmentByCode(deptCode)
	if repository.IsNotFound(err) {
		return NewValidationError("院系编码不存在：" + deptCode)
	}
	if err != nil {
		return err
	}
	req.DeptID = dept.ID
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return NewValidationError("专业名称不能为空")
	}
	code := strings.TrimSpace(req.Code)
	if code != "" {
		existing, err := s.repo.FindMajorByDeptAndCode(dept.ID, code)
		if err == nil {
			existing.Name = name
			return s.repo.SaveMajor(existing)
		}
		if !repository.IsNotFound(err) {
			return err
		}
	} else {
		existing, err := s.repo.FindMajorByDeptAndName(dept.ID, name)
		if err == nil {
			return s.repo.SaveMajor(existing)
		}
		if !repository.IsNotFound(err) {
			return err
		}
	}
	_, err = s.CreateMajor(req)
	return err
}

// UpsertGrade 按入学年份 upsert。
func (s *OrgService) UpsertGrade(req *dto.GradeRequest) error {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return NewValidationError("年级名称不能为空")
	}
	if req.Year <= 0 {
		return NewValidationError("入学年份必须为正整数")
	}
	existing, err := s.repo.FindGradeByYear(req.Year)
	if err == nil {
		existing.Name = name
		return s.repo.SaveGrade(existing)
	}
	if !repository.IsNotFound(err) {
		return err
	}
	_, err = s.CreateGrade(req)
	return err
}

// ClassImportInput 班级导入行（含编码/教工号等可读字段）。
type ClassImportInput struct {
	DeptCode  string
	MajorCode string
	GradeYear int
	Name      string
	StaffNo   string
}

// UpsertClass 按「院系编码 + 班级名称」upsert；教工号必须已在班主任信息中存在。
func (s *OrgService) UpsertClass(in *ClassImportInput) error {
	deptCode := strings.TrimSpace(in.DeptCode)
	if deptCode == "" {
		return NewValidationError("院系编码不能为空")
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return NewValidationError("班级名称不能为空")
	}
	dept, err := s.repo.FindDepartmentByCode(deptCode)
	if repository.IsNotFound(err) {
		return NewValidationError("院系编码不存在：" + deptCode)
	}
	if err != nil {
		return err
	}

	req := &dto.ClassRequest{DeptID: dept.ID, Name: name, StaffNo: strings.TrimSpace(in.StaffNo)}
	if mc := strings.TrimSpace(in.MajorCode); mc != "" {
		major, mErr := s.repo.FindMajorByDeptAndCode(dept.ID, mc)
		if repository.IsNotFound(mErr) {
			return NewValidationError("专业编码不存在：" + mc)
		}
		if mErr != nil {
			return mErr
		}
		req.MajorID = major.ID
	}
	if in.GradeYear > 0 {
		grade, gErr := s.repo.FindGradeByYear(in.GradeYear)
		if repository.IsNotFound(gErr) {
			return NewValidationError(fmt.Sprintf("入学年份 %d 对应的年级不存在", in.GradeYear))
		}
		if gErr != nil {
			return gErr
		}
		req.GradeID = grade.ID
	}

	existing, err := s.repo.FindClassByDeptAndName(dept.ID, name)
	if err == nil {
		_, err = s.UpdateClass(existing.ID, req)
		return err
	}
	if !repository.IsNotFound(err) {
		return err
	}
	_, err = s.CreateClass(req)
	return err
}
