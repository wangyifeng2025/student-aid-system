package service

import (
	"fmt"
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/validate"
	"gorm.io/gorm"
)

// GrantService 助学金申请业务（预填、填报、提交）。
type GrantService struct {
	repo    *repository.GrantRepository
	recRepo *repository.RecognitionRepository
	stuRepo *repository.StudentRepository
	orgRepo *repository.OrgRepository
	userRepo *repository.UserRepository
}

func NewGrantService(db *gorm.DB) *GrantService {
	return &GrantService{
		repo:    repository.NewGrantRepository(db),
		recRepo: repository.NewRecognitionRepository(db),
		stuRepo: repository.NewStudentRepository(db),
		orgRepo: repository.NewOrgRepository(db),
		userRepo: repository.NewUserRepository(db),
	}
}

func (s *GrantService) List(actor rbac.Actor, f repository.GrantFilter) (*dto.PageResult[dto.GrantListItem], error) {
	if isReviewerRole(actor.Role) {
		f.ExcludeStatuses = []string{string(model.GrantStatusDraft)}
	}
	items, total, err := s.repo.List(actor, f)
	if err != nil {
		return nil, err
	}
	return s.buildListResult(items, total, f.Page, f.PageSize)
}

func (s *GrantService) Get(actor rbac.Actor, id uint) (*dto.GrantResponse, error) {
	ok, err := s.repo.CanAccess(actor, id)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound
	}
	a, err := s.repo.FindByID(id)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if isReviewerRole(actor.Role) && a.Status == model.GrantStatusDraft {
		return nil, ErrNotFound
	}
	return s.buildResponse(a)
}

// Create 学生基于已通过的认定申请发起助学金草稿（自动预填）。
func (s *GrantService) Create(actor rbac.Actor, req *dto.CreateGrantRequest) (*dto.GrantResponse, error) {
	if actor.Role != model.RoleStudent {
		return nil, ErrForbidden
	}
	stu, err := s.stuRepo.FindByUserID(actor.UserID)
	if repository.IsNotFound(err) {
		return nil, NewValidationError("当前账号未关联学生档案，无法申请助学金")
	}
	if err != nil {
		return nil, err
	}
	rec, err := s.recRepo.FindByID(req.RecognitionID)
	if repository.IsNotFound(err) {
		return nil, NewValidationError("关联的认定申请不存在")
	}
	if err != nil {
		return nil, err
	}
	if rec.StudentID != stu.ID {
		return nil, ErrForbidden
	}
	if rec.Status != model.StatusApproved {
		return nil, NewValidationError("仅困难认定通过后可申请助学金")
	}

	grantType := model.GrantNationalAid
	if gt := strings.TrimSpace(req.GrantType); gt != "" {
		grantType = model.GrantType(gt)
	}
	exists, err := s.repo.ExistsByStudentYearType(stu.ID, rec.Year, grantType, 0)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrDuplicate
	}

	monthlyTotal := rec.PerCapitaAnnualIncome * float64(rec.FamilyPopulation) / 12
	perCapitaMonthly := rec.PerCapitaAnnualIncome / 12

	members := make([]model.GrantFamilyMember, 0, len(rec.FamilyMembers))
	for _, m := range rec.FamilyMembers {
		members = append(members, model.GrantFamilyMember{
			Name: m.Name, Age: m.Age, Relation: m.Relation, WorkUnit: m.WorkUnit,
		})
	}

	a := &model.GrantApplication{
		StudentID: stu.ID, RecognitionID: rec.ID, GrantType: grantType, Year: rec.Year,
		Status: model.GrantStatusDraft,
		Phone:  rec.Phone,
		HouseholdType: rec.HouseholdType, FamilyPopulation: rec.FamilyPopulation,
		MonthlyIncome: monthlyTotal, PerCapitaMonthlyIncome: perCapitaMonthly,
		IncomeSource: rec.IncomeSource, Address: rec.Address, PostalCode: rec.PostalCode,
		FamilyMembers: members,
	}
	if err := s.repo.Create(a); err != nil {
		return nil, err
	}
	return s.buildResponse(a)
}

func (s *GrantService) Update(actor rbac.Actor, id uint, req *dto.GrantRequest) (*dto.GrantResponse, error) {
	a, _, err := s.loadOwned(actor, id)
	if err != nil {
		return nil, err
	}
	if !grantEditable(a.Status) {
		return nil, NewValidationError("当前状态不可修改（仅草稿或被退回的申请可编辑）")
	}
	if err := s.validateFormat(req); err != nil {
		return nil, err
	}
	dto.ApplyGrant(a, req)
	members := dto.BuildGrantMembers(req.FamilyMembers)
	if err := s.repo.SaveWithMembers(a, members); err != nil {
		return nil, err
	}
	return s.buildResponse(a)
}

func (s *GrantService) Delete(actor rbac.Actor, id uint) error {
	a, _, err := s.loadOwned(actor, id)
	if err != nil {
		return err
	}
	if !grantEditable(a.Status) {
		return NewValidationError("当前状态不可删除")
	}
	return s.repo.Delete(id)
}

func (s *GrantService) Submit(actor rbac.Actor, id uint) (*dto.GrantResponse, error) {
	a, _, err := s.loadOwned(actor, id)
	if err != nil {
		return nil, err
	}
	if !grantEditable(a.Status) {
		return nil, NewValidationError("当前状态不可提交")
	}
	if err := s.validateForSubmit(a); err != nil {
		return nil, err
	}
	a.Status = model.GrantStatusPendingClass
	a.CurrentLevel = model.LevelClass
	a.RejectReason = ""
	if err := s.repo.UpdateStatusFields(a); err != nil {
		return nil, err
	}
	return s.buildResponse(a)
}

func (s *GrantService) buildListResult(items []model.GrantApplication, total int64, page, pageSize int) (*dto.PageResult[dto.GrantListItem], error) {
	ids := make([]uint, 0, len(items))
	for i := range items {
		ids = append(ids, items[i].StudentID)
	}
	students, err := s.stuRepo.FindMapByIDs(ids)
	if err != nil {
		return nil, err
	}
	deptNames, majorNames, classNames, err := buildOrgNameMaps(s.orgRepo)
	if err != nil {
		return nil, err
	}
	list := make([]dto.GrantListItem, 0, len(items))
	for i := range items {
		a := &items[i]
		stu := students[a.StudentID]
		list = append(list, dto.GrantListItem{
			ID: a.ID, StudentID: a.StudentID, StudentNo: stu.StudentNo, StudentName: stu.Name,
			DeptName: deptNames[stu.DeptID], MajorName: majorNames[stu.MajorID], ClassName: classNames[stu.ClassID],
			Year: a.Year, GrantType: string(a.GrantType), Status: string(a.Status), CurrentLevel: int(a.CurrentLevel),
		})
	}
	return &dto.PageResult[dto.GrantListItem]{Items: list, Total: total, Page: page, PageSize: pageSize}, nil
}

func (s *GrantService) buildResponse(a *model.GrantApplication) (*dto.GrantResponse, error) {
	if a.FamilyMembers == nil || a.Reviews == nil {
		full, err := s.repo.FindByID(a.ID)
		if err != nil {
			return nil, err
		}
		a = full
	}
	stu, _ := s.stuRepo.FindStudent(a.StudentID)
	schoolUnit, gradeName := s.resolveSchoolUnit(stu)
	resp := dto.ToGrantResponse(a, stu, schoolUnit, gradeName)
	names := s.grantReviewNames(a.Reviews)
	resp.Reviews = dto.ToReviewRecordResponses(toGenericReviews(a.Reviews), names)
	return &resp, nil
}

func (s *GrantService) grantReviewNames(records []model.GrantReviewRecord) map[uint]string {
	if len(records) == 0 {
		return map[uint]string{}
	}
	ids := make([]uint, 0, len(records))
	for i := range records {
		ids = append(ids, records[i].ReviewerID)
	}
	names, err := s.userRepo.FindNamesByIDs(ids)
	if err != nil {
		return map[uint]string{}
	}
	return names
}

func (s *GrantService) resolveSchoolUnit(stu *model.Student) (string, string) {
	if stu == nil {
		return "", ""
	}
	deptName, majorName, className, gradeName := "", "", "", ""
	if dept, err := s.orgRepo.FindDepartment(stu.DeptID); err == nil {
		deptName = dept.Name
	}
	if major, err := s.orgRepo.FindMajor(stu.MajorID); err == nil {
		majorName = major.Name
	}
	if cls, err := s.orgRepo.FindClass(stu.ClassID); err == nil {
		className = cls.Name
		if grade, gErr := s.orgRepo.FindGrade(cls.GradeID); gErr == nil {
			gradeName = grade.Name
		}
	}
	unit := fmt.Sprintf("%s%s%s%s", deptName, gradeName, majorName, className)
	return unit, gradeName
}

func (s *GrantService) loadOwned(actor rbac.Actor, id uint) (*model.GrantApplication, *model.Student, error) {
	if actor.Role != model.RoleStudent {
		return nil, nil, ErrForbidden
	}
	a, err := s.repo.FindByID(id)
	if repository.IsNotFound(err) {
		return nil, nil, ErrNotFound
	}
	if err != nil {
		return nil, nil, err
	}
	stu, err := s.stuRepo.FindStudent(a.StudentID)
	if err != nil {
		return nil, nil, err
	}
	if stu.UserID == nil || *stu.UserID != actor.UserID {
		return nil, nil, ErrForbidden
	}
	return a, stu, nil
}

func grantEditable(status model.GrantStatus) bool {
	return status == model.GrantStatusDraft || status == model.GrantStatusRejected
}

func (s *GrantService) validateFormat(req *dto.GrantRequest) error {
	if req.Phone != "" && !validate.Phone(req.Phone) {
		return NewValidationError("联系电话格式不正确")
	}
	return nil
}

func (s *GrantService) validateForSubmit(a *model.GrantApplication) error {
	if !validate.Phone(a.Phone) {
		return NewValidationError("请填写正确的联系电话")
	}
	if a.FamilyPopulation <= 0 {
		return NewValidationError("请填写家庭总人数")
	}
	if strings.TrimSpace(a.Address) == "" {
		return NewValidationError("请填写家庭住址")
	}
	if len(strings.TrimSpace(a.Reason)) < 10 {
		return NewValidationError("申请理由不少于 10 个字（建议 150 字左右）")
	}
	if len(a.FamilyMembers) == 0 {
		return NewValidationError("请至少填写一名家庭成员")
	}
	return nil
}

// toGenericReviews 将助学金评审记录转为认定评审结构以复用 DTO 转换。
func toGenericReviews(records []model.GrantReviewRecord) []model.ReviewRecord {
	out := make([]model.ReviewRecord, 0, len(records))
	for i := range records {
		r := records[i]
		out = append(out, model.ReviewRecord{
			BaseModel: r.BaseModel, Level: r.Level, ReviewerID: r.ReviewerID,
			Action: r.Action, Opinion: r.Opinion, RejectToLevel: r.RejectToLevel,
		})
	}
	return out
}
