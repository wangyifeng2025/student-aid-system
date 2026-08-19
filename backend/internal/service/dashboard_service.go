package service

import (
	"fmt"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"gorm.io/gorm"
)

const dashboardListLimit = 8

// DashboardService 工作台概览（按角色数据范围汇总认定/助学金）。
type DashboardService struct {
	rec      *RecognitionService
	rev      *ReviewService
	grant    *GrantService
	grantRev *GrantReviewService
	orgRepo  *repository.OrgRepository
	stuRepo  *repository.StudentRepository
}

func NewDashboardService(db *gorm.DB) *DashboardService {
	return &DashboardService{
		rec:      NewRecognitionService(db),
		rev:      NewReviewService(db),
		grant:    NewGrantService(db),
		grantRev: NewGrantReviewService(db),
		orgRepo:  repository.NewOrgRepository(db),
		stuRepo:  repository.NewStudentRepository(db),
	}
}

func dashboardScopeLabel(scope rbac.DataScope) string {
	switch scope {
	case rbac.ScopeSelf:
		return "仅本人"
	case rbac.ScopeClass:
		return "本班级"
	case rbac.ScopeDepartment:
		return "本教学系"
	case rbac.ScopeSchool:
		return "全校"
	default:
		return string(scope)
	}
}

func dashboardReviewHint(role model.Role) string {
	switch role {
	case model.RoleClassAdvisor:
		return "班级评审待办"
	case model.RoleDepartment:
		return "教学系评审待办"
	case model.RoleAidCenter:
		return "院级评审待办"
	case model.RoleAdmin:
		return "各级待审"
	default:
		return "待办"
	}
}

// Overview 返回当前操作者数据范围内的工作台汇总。
func (s *DashboardService) Overview(actor rbac.Actor, year int) (*dto.DashboardOverview, error) {
	if year <= 0 {
		year = time.Now().Year()
	}
	scope := actor.Scope()
	scopeLabel := dashboardScopeLabel(scope)
	hint := fmt.Sprintf("%s · %d学年", scopeLabel, year)

	recFilter := repository.RecognitionFilter{Year: year, Page: 1, PageSize: dashboardListLimit}
	recPage, err := s.rec.List(actor, recFilter)
	if err != nil {
		return nil, err
	}
	approvedPage, err := s.rec.List(actor, repository.RecognitionFilter{
		Year: year, Status: string(model.StatusApproved), Page: 1, PageSize: 1,
	})
	if err != nil {
		return nil, err
	}

	grantFilter := repository.GrantFilter{Year: year, Page: 1, PageSize: dashboardListLimit}
	grantPage, err := s.grant.List(actor, grantFilter)
	if err != nil {
		return nil, err
	}

	out := &dto.DashboardOverview{
		Year:       year,
		Role:       string(actor.Role),
		DataScope:  string(scope),
		ScopeLabel: scopeLabel,
		Recents:    mergeDashboardItems(toRecDashboard(recPage.Items), toGrantDashboard(grantPage.Items), dashboardListLimit),
	}
	s.applyAffiliation(actor, out)

	if actor.Role == model.RoleStudent {
		return s.fillStudent(actor, year, hint, recPage, approvedPage, grantPage, out)
	}
	return s.fillReviewer(actor, recFilter, grantFilter, hint, recPage, approvedPage, out)
}

// applyAffiliation 解析当前用户所属院系/班级名称（学生取学籍，其他角色取账号关联）。
func (s *DashboardService) applyAffiliation(actor rbac.Actor, out *dto.DashboardOverview) {
	var deptID, classID uint
	if actor.DeptID != nil {
		deptID = *actor.DeptID
	}
	if actor.ClassID != nil {
		classID = *actor.ClassID
	}
	if actor.Role == model.RoleStudent {
		stu, err := s.stuRepo.FindByUserID(actor.UserID)
		if err == nil && stu != nil {
			deptID = stu.DeptID
			classID = stu.ClassID
		}
	}
	if deptID == 0 && classID == 0 {
		return
	}
	deptNames, _, classNames, err := buildOrgNameMaps(s.orgRepo)
	if err != nil {
		return
	}
	out.DeptName = deptNames[deptID]
	out.ClassName = classNames[classID]
}

func (s *DashboardService) fillStudent(
	actor rbac.Actor,
	year int,
	hint string,
	recPage, approvedPage *dto.PageResult[dto.RecognitionListItem],
	grantPage *dto.PageResult[dto.GrantListItem],
	out *dto.DashboardOverview,
) (*dto.DashboardOverview, error) {
	draftPage, err := s.rec.List(actor, repository.RecognitionFilter{
		Year: year, Status: string(model.StatusDraft), Page: 1, PageSize: dashboardListLimit,
	})
	if err != nil {
		return nil, err
	}
	rejectedPage, err := s.rec.List(actor, repository.RecognitionFilter{
		Year: year, Status: string(model.StatusRejected), Page: 1, PageSize: dashboardListLimit,
	})
	if err != nil {
		return nil, err
	}
	grantDraft, err := s.grant.List(actor, repository.GrantFilter{
		Year: year, Status: string(model.GrantStatusDraft), Page: 1, PageSize: dashboardListLimit,
	})
	if err != nil {
		return nil, err
	}
	grantRejected, err := s.grant.List(actor, repository.GrantFilter{
		Year: year, Status: string(model.GrantStatusRejected), Page: 1, PageSize: dashboardListLimit,
	})
	if err != nil {
		return nil, err
	}

	actionTotal := draftPage.Total + rejectedPage.Total + grantDraft.Total + grantRejected.Total
	out.KPIs = []dto.DashboardKPI{
		{Key: "recognition_total", Label: "认定申请", Value: recPage.Total, Hint: hint},
		{Key: "recognition_action", Label: "待处理", Value: actionTotal, Hint: "草稿或已退回"},
		{Key: "recognition_approved", Label: "已通过", Value: approvedPage.Total, Hint: hint},
		{Key: "grant_total", Label: "助学金申请", Value: grantPage.Total, Hint: hint},
	}
	out.Todos = mergeDashboardItems(
		append(toRecDashboard(draftPage.Items), toRecDashboard(rejectedPage.Items)...),
		append(toGrantDashboard(grantDraft.Items), toGrantDashboard(grantRejected.Items)...),
		dashboardListLimit,
	)
	return out, nil
}

func (s *DashboardService) fillReviewer(
	actor rbac.Actor,
	recFilter repository.RecognitionFilter,
	grantFilter repository.GrantFilter,
	hint string,
	recPage, approvedPage *dto.PageResult[dto.RecognitionListItem],
	out *dto.DashboardOverview,
) (*dto.DashboardOverview, error) {
	todoPage, err := s.rev.Todo(actor, recFilter)
	if err != nil {
		return nil, err
	}
	grantTodo, err := s.grantRev.Todo(actor, grantFilter)
	if err != nil {
		return nil, err
	}
	reviewHint := dashboardReviewHint(actor.Role)
	out.KPIs = []dto.DashboardKPI{
		{Key: "recognition_total", Label: "认定申请", Value: recPage.Total, Hint: hint},
		{Key: "recognition_todo", Label: "认定待审", Value: todoPage.Total, Hint: reviewHint},
		{Key: "recognition_approved", Label: "已通过", Value: approvedPage.Total, Hint: hint},
		{Key: "grant_todo", Label: "助学金待审", Value: grantTodo.Total, Hint: reviewHint},
	}
	out.Todos = mergeDashboardItems(toRecDashboard(todoPage.Items), toGrantDashboard(grantTodo.Items), dashboardListLimit)
	return out, nil
}

func toRecDashboard(items []dto.RecognitionListItem) []dto.DashboardItem {
	out := make([]dto.DashboardItem, 0, len(items))
	for _, it := range items {
		out = append(out, dto.DashboardItem{
			ID:          it.ID,
			Kind:        "recognition",
			StudentName: it.StudentName,
			StudentNo:   it.StudentNo,
			ClassName:   it.ClassName,
			Status:      it.Status,
			Title:       "困难认定",
		})
	}
	return out
}

func toGrantDashboard(items []dto.GrantListItem) []dto.DashboardItem {
	out := make([]dto.DashboardItem, 0, len(items))
	for _, it := range items {
		out = append(out, dto.DashboardItem{
			ID:          it.ID,
			Kind:        "grant",
			StudentName: it.StudentName,
			StudentNo:   it.StudentNo,
			ClassName:   it.ClassName,
			Status:      it.Status,
			Title:       "国家助学金",
		})
	}
	return out
}

func mergeDashboardItems(a, b []dto.DashboardItem, limit int) []dto.DashboardItem {
	out := make([]dto.DashboardItem, 0, len(a)+len(b))
	out = append(out, a...)
	out = append(out, b...)
	if len(out) > limit {
		return out[:limit]
	}
	return out
}
