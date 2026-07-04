package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"gorm.io/gorm"
)

// GrantReviewService 助学金三级评审与退回。
type GrantReviewService struct {
	repo     *repository.GrantRepository
	stuRepo  *repository.StudentRepository
	orgRepo  *repository.OrgRepository
	userRepo *repository.UserRepository
}

func NewGrantReviewService(db *gorm.DB) *GrantReviewService {
	return &GrantReviewService{
		repo:     repository.NewGrantRepository(db),
		stuRepo:  repository.NewStudentRepository(db),
		orgRepo:  repository.NewOrgRepository(db),
		userRepo: repository.NewUserRepository(db),
	}
}

var grantStatusLevel = map[model.GrantStatus]model.ReviewLevel{
	model.GrantStatusPendingClass:   model.LevelClass,
	model.GrantStatusPendingDept:    model.LevelDepartment,
	model.GrantStatusPendingCollege: model.LevelCollege,
}

var grantPassNextStatus = map[model.GrantStatus]model.GrantStatus{
	model.GrantStatusPendingClass:   model.GrantStatusPendingDept,
	model.GrantStatusPendingDept:    model.GrantStatusPendingCollege,
	model.GrantStatusPendingCollege: model.GrantStatusApproved,
}

var grantLevelStatus = map[model.ReviewLevel]model.GrantStatus{
	model.LevelClass:      model.GrantStatusPendingClass,
	model.LevelDepartment: model.GrantStatusPendingDept,
	model.LevelCollege:    model.GrantStatusPendingCollege,
}

func grantTodoStatusesForRole(role model.Role) []string {
	switch role {
	case model.RoleClassAdvisor:
		return []string{string(model.GrantStatusPendingClass)}
	case model.RoleDepartment:
		return []string{string(model.GrantStatusPendingDept)}
	case model.RoleAidCenter:
		return []string{string(model.GrantStatusPendingCollege)}
	case model.RoleAdmin:
		return []string{
			string(model.GrantStatusPendingClass),
			string(model.GrantStatusPendingDept),
			string(model.GrantStatusPendingCollege),
		}
	default:
		return nil
	}
}

func grantRecordsTodoStatusesForRole(role model.Role) []string {
	switch role {
	case model.RoleClassAdvisor:
		return []string{string(model.GrantStatusPendingClass)}
	case model.RoleDepartment:
		return []string{string(model.GrantStatusPendingClass), string(model.GrantStatusPendingDept)}
	case model.RoleAidCenter, model.RoleAdmin:
		return []string{
			string(model.GrantStatusPendingClass),
			string(model.GrantStatusPendingDept),
			string(model.GrantStatusPendingCollege),
		}
	default:
		return nil
	}
}

func (s *GrantReviewService) Todo(actor rbac.Actor, f repository.GrantFilter) (*dto.PageResult[dto.GrantListItem], error) {
	statuses := grantTodoStatusesForRole(actor.Role)
	if len(statuses) == 0 {
		return nil, ErrForbidden
	}
	if f.Status != "" {
		if !containsString(statuses, f.Status) {
			return nil, NewValidationError("无权查看该状态的待办")
		}
		statuses = []string{f.Status}
		f.Status = ""
	}
	items, total, err := s.repo.ListByStatuses(actor, statuses, f)
	if err != nil {
		return nil, err
	}
	return s.buildList(items, total, f.Page, f.PageSize)
}

func (s *GrantReviewService) Records(actor rbac.Actor, tab string, f repository.GrantFilter) (*dto.PageResult[dto.GrantListItem], error) {
	if !isReviewerRole(actor.Role) && actor.Role != model.RoleAdmin {
		return nil, ErrForbidden
	}
	switch tab {
	case "", "all":
		items, total, err := s.repo.ListSubmitted(actor, f)
		if err != nil {
			return nil, err
		}
		return s.buildList(items, total, f.Page, f.PageSize)
	case "todo":
		return s.recordsTodo(actor, f)
	case "done":
		items, total, err := s.repo.ListReviewedByActor(actor, f)
		if err != nil {
			return nil, err
		}
		return s.buildList(items, total, f.Page, f.PageSize)
	default:
		return nil, NewValidationError("tab 参数无效（可选：todo、done、all）")
	}
}

func (s *GrantReviewService) recordsTodo(actor rbac.Actor, f repository.GrantFilter) (*dto.PageResult[dto.GrantListItem], error) {
	statuses := grantRecordsTodoStatusesForRole(actor.Role)
	if len(statuses) == 0 {
		return nil, ErrForbidden
	}
	if f.Status != "" {
		if !containsString(statuses, f.Status) {
			return nil, NewValidationError("无权查看该状态的记录")
		}
		statuses = []string{f.Status}
		f.Status = ""
	}
	items, total, err := s.repo.ListByStatuses(actor, statuses, f)
	if err != nil {
		return nil, err
	}
	return s.buildList(items, total, f.Page, f.PageSize)
}

func (s *GrantReviewService) Pass(actor rbac.Actor, id uint, req *dto.ReviewActionRequest) (*dto.GrantResponse, error) {
	a, level, err := s.loadActionable(actor, id)
	if err != nil {
		return nil, err
	}
	next := grantPassNextStatus[a.Status]
	a.Status = next
	if next == model.GrantStatusApproved {
		a.CurrentLevel = model.LevelCollege
	} else {
		a.CurrentLevel = grantStatusLevel[next]
	}
	a.RejectReason = ""
	rec := &model.GrantReviewRecord{
		Level: level, ReviewerID: actor.UserID, Action: model.ActionPass,
		Opinion: strings.TrimSpace(req.Opinion),
	}
	if err := s.repo.Transition(a, rec); err != nil {
		return nil, err
	}
	return s.buildDetail(a.ID)
}

func (s *GrantReviewService) Reject(actor rbac.Actor, id uint, req *dto.ReviewActionRequest) (*dto.GrantResponse, error) {
	a, level, err := s.loadActionable(actor, id)
	if err != nil {
		return nil, err
	}
	opinion := strings.TrimSpace(req.Opinion)
	if opinion == "" {
		return nil, NewValidationError("退回时必须填写退回意见")
	}
	target := model.ReviewLevel(0)
	if req.RejectToLevel != nil {
		target = model.ReviewLevel(*req.RejectToLevel)
	}
	if target < 0 || target >= level {
		return nil, NewValidationError("退回级别必须低于当前评审级别")
	}
	if target == 0 {
		a.Status = model.GrantStatusRejected
		a.CurrentLevel = 0
	} else {
		st, ok := grantLevelStatus[target]
		if !ok {
			return nil, NewValidationError("退回级别无效")
		}
		a.Status = st
		a.CurrentLevel = target
	}
	a.RejectReason = opinion
	rec := &model.GrantReviewRecord{
		Level: level, ReviewerID: actor.UserID, Action: model.ActionReject,
		Opinion: opinion, RejectToLevel: target,
	}
	if err := s.repo.Transition(a, rec); err != nil {
		return nil, err
	}
	return s.buildDetail(a.ID)
}

func (s *GrantReviewService) Withdraw(actor rbac.Actor, id uint) (*dto.GrantResponse, error) {
	if !isReviewerRole(actor.Role) && actor.Role != model.RoleAdmin {
		return nil, ErrForbidden
	}
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
	if len(a.Reviews) == 0 {
		return nil, NewValidationError("无可撤回的评审记录")
	}
	last := a.Reviews[len(a.Reviews)-1]
	if last.ReviewerID != actor.UserID {
		return nil, NewValidationError("仅可撤回本人最近一次评审意见")
	}
	if !roleCanActLevel(actor.Role, last.Level) {
		return nil, ErrForbidden
	}
	pending, ok := grantLevelStatus[last.Level]
	if !ok {
		return nil, NewValidationError("当前评审记录不可撤回")
	}
	a.Status = pending
	a.CurrentLevel = last.Level
	a.RejectReason = ""
	if err := s.repo.RevertReview(a, last.ID); err != nil {
		return nil, err
	}
	return s.buildDetail(a.ID)
}

func (s *GrantReviewService) Get(actor rbac.Actor, id uint) (*dto.GrantResponse, error) {
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
	return s.buildDetail(a.ID)
}

func (s *GrantReviewService) loadActionable(actor rbac.Actor, id uint) (*model.GrantApplication, model.ReviewLevel, error) {
	ok, err := s.repo.CanAccess(actor, id)
	if err != nil {
		return nil, 0, err
	}
	if !ok {
		return nil, 0, ErrNotFound
	}
	a, err := s.repo.FindByID(id)
	if repository.IsNotFound(err) {
		return nil, 0, ErrNotFound
	}
	if err != nil {
		return nil, 0, err
	}
	level, ok := grantStatusLevel[a.Status]
	if !ok {
		return nil, 0, NewValidationError("当前状态不可评审")
	}
	if !roleCanActLevel(actor.Role, level) {
		return nil, 0, ErrForbidden
	}
	return a, level, nil
}

func (s *GrantReviewService) buildList(items []model.GrantApplication, total int64, page, pageSize int) (*dto.PageResult[dto.GrantListItem], error) {
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

func (s *GrantReviewService) buildDetail(id uint) (*dto.GrantResponse, error) {
	a, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	stu, _ := s.stuRepo.FindStudent(a.StudentID)
	schoolUnit, gradeName := resolveGrantSchoolUnit(s.orgRepo, stu)
	resp := dto.ToGrantResponse(a, stu, schoolUnit, gradeName)
	names, _ := s.userRepo.FindNamesByIDs(reviewerIDs(a.Reviews))
	resp.Reviews = dto.ToReviewRecordResponses(toGenericReviews(a.Reviews), names)
	return &resp, nil
}

func reviewerIDs(records []model.GrantReviewRecord) []uint {
	ids := make([]uint, 0, len(records))
	for i := range records {
		ids = append(ids, records[i].ReviewerID)
	}
	return ids
}

func resolveGrantSchoolUnit(orgRepo *repository.OrgRepository, stu *model.Student) (string, string) {
	if stu == nil {
		return "", ""
	}
	deptName, majorName, className, gradeName := "", "", "", ""
	if dept, err := orgRepo.FindDepartment(stu.DeptID); err == nil {
		deptName = dept.Name
	}
	if major, err := orgRepo.FindMajor(stu.MajorID); err == nil {
		majorName = major.Name
	}
	if cls, err := orgRepo.FindClass(stu.ClassID); err == nil {
		className = cls.Name
		if grade, gErr := orgRepo.FindGrade(cls.GradeID); gErr == nil {
			gradeName = grade.Name
		}
	}
	return fmt.Sprintf("%s%s%s%s", deptName, gradeName, majorName, className), gradeName
}

// grantErrMessage 批量结果用（预留）。
func grantErrMessage(err error) string {
	var ve *ValidationError
	if errors.As(err, &ve) {
		return ve.Msg
	}
	switch {
	case errors.Is(err, ErrNotFound):
		return "记录不存在或不在数据范围内"
	case errors.Is(err, ErrForbidden):
		return "没有评审权限"
	default:
		return "操作失败"
	}
}
