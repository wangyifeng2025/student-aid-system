package service

import (
	"errors"
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"gorm.io/gorm"
)

// ReviewService 模块 5：三级评审与退回流程引擎。
// 流转：草稿 → 待班级 → 待教学系 → 待院级 → 认定通过（院级通过即完成认定，学生可发起助学金申请）；
// 任一级可退回到学生或更低级别（附退回意见）。每次动作写入评审流转记录（审计）。
type ReviewService struct {
	repo     *repository.RecognitionRepository
	stuRepo  *repository.StudentRepository
	orgRepo  *repository.OrgRepository
	userRepo *repository.UserRepository
}

func NewReviewService(db *gorm.DB) *ReviewService {
	return &ReviewService{
		repo:     repository.NewRecognitionRepository(db),
		stuRepo:  repository.NewStudentRepository(db),
		orgRepo:  repository.NewOrgRepository(db),
		userRepo: repository.NewUserRepository(db),
	}
}

// statusLevel 各待审状态对应的评审级别。
var statusLevel = map[model.ApplicationStatus]model.ReviewLevel{
	model.StatusPendingClass:   model.LevelClass,
	model.StatusPendingDept:    model.LevelDepartment,
	model.StatusPendingCollege: model.LevelCollege,
	model.StatusPendingFinal:   model.LevelFinal,
}

// passNextStatus 通过后流转到的下一状态。
var passNextStatus = map[model.ApplicationStatus]model.ApplicationStatus{
	model.StatusPendingClass:   model.StatusPendingDept,
	model.StatusPendingDept:    model.StatusPendingCollege,
	model.StatusPendingCollege: model.StatusApproved,
	model.StatusPendingFinal:   model.StatusApproved, // 兼容历史 pending_final 数据
}

// levelStatus 退回目标级别 → 对应待审状态（0 表示退回学生重填）。
var levelStatus = map[model.ReviewLevel]model.ApplicationStatus{
	model.LevelClass:      model.StatusPendingClass,
	model.LevelDepartment: model.StatusPendingDept,
	model.LevelCollege:    model.StatusPendingCollege,
	model.LevelFinal:      model.StatusPendingFinal,
}

// roleCanActLevel 判断角色是否有权在指定级别评审。
func roleCanActLevel(role model.Role, level model.ReviewLevel) bool {
	switch role {
	case model.RoleAdmin:
		return true
	case model.RoleClassAdvisor:
		return level == model.LevelClass
	case model.RoleDepartment:
		return level == model.LevelDepartment
	case model.RoleAidCenter:
		return level == model.LevelCollege || level == model.LevelFinal
	default:
		return false
	}
}

// recordsTodoStatusesForRole 认定记录「待审核」标签：本级待办 + 下级正在审核的状态。
func recordsTodoStatusesForRole(role model.Role) []string {
	switch role {
	case model.RoleClassAdvisor:
		return []string{string(model.StatusPendingClass)}
	case model.RoleDepartment:
		return []string{
			string(model.StatusPendingClass),
			string(model.StatusPendingDept),
		}
	case model.RoleAidCenter:
		return []string{
			string(model.StatusPendingClass),
			string(model.StatusPendingDept),
			string(model.StatusPendingCollege),
			string(model.StatusPendingFinal),
		}
	case model.RoleAdmin:
		return []string{
			string(model.StatusPendingClass),
			string(model.StatusPendingDept),
			string(model.StatusPendingCollege),
			string(model.StatusPendingFinal),
		}
	default:
		return nil
	}
}

// todoStatusesForRole 返回角色待办应包含的状态集合（仅本级，用于 /reviews/todo）。
func todoStatusesForRole(role model.Role) []string {
	switch role {
	case model.RoleClassAdvisor:
		return []string{string(model.StatusPendingClass)}
	case model.RoleDepartment:
		return []string{string(model.StatusPendingDept)}
	case model.RoleAidCenter:
		// 院级为终审；pending_final 仅兼容历史数据。
		return []string{string(model.StatusPendingCollege), string(model.StatusPendingFinal)}
	case model.RoleAdmin:
		return []string{
			string(model.StatusPendingClass), string(model.StatusPendingDept),
			string(model.StatusPendingCollege), string(model.StatusPendingFinal),
		}
	default:
		return nil
	}
}

// recordsTodo 认定记录「待审核」：本级待办或下级正在审核的申请。
func (s *ReviewService) recordsTodo(actor rbac.Actor, f repository.RecognitionFilter) (*dto.PageResult[dto.RecognitionListItem], error) {
	statuses := recordsTodoStatusesForRole(actor.Role)
	if len(statuses) == 0 {
		return nil, ErrForbidden
	}
	if f.Status != "" {
		if !containsString(statuses, f.Status) {
			return nil, NewValidationError("无权查看该状态的认定记录")
		}
		statuses = []string{f.Status}
		f.Status = ""
	}
	items, total, err := s.repo.ListByStatuses(actor, statuses, f)
	if err != nil {
		return nil, err
	}
	list, err := s.buildRecognitionListItems(items)
	if err != nil {
		return nil, err
	}
	return &dto.PageResult[dto.RecognitionListItem]{
		Items:    list,
		Total:    total,
		Page:     f.Page,
		PageSize: f.PageSize,
	}, nil
}

// Todo 按角色 + 数据范围列出待办（本级待审申请）。
func (s *ReviewService) Todo(actor rbac.Actor, f repository.RecognitionFilter) (*dto.PageResult[dto.RecognitionListItem], error) {
	statuses := todoStatusesForRole(actor.Role)
	if len(statuses) == 0 {
		return nil, ErrForbidden
	}
	// 指定状态筛选时须落在角色允许的待办状态内。
	if f.Status != "" {
		if !containsString(statuses, f.Status) {
			return nil, NewValidationError("无权查看该状态的待办")
		}
		statuses = []string{f.Status}
		f.Status = "" // 已并入 statuses，避免重复条件
	}
	items, total, err := s.repo.ListByStatuses(actor, statuses, f)
	if err != nil {
		return nil, err
	}
	list, err := s.buildRecognitionListItems(items)
	if err != nil {
		return nil, err
	}
	return &dto.PageResult[dto.RecognitionListItem]{
		Items:    list,
		Total:    total,
		Page:     f.Page,
		PageSize: f.PageSize,
	}, nil
}

// Records 按 tab 列出认定记录（待办/已审核/全部），不含学生未提交的草稿。
// tab: todo | done | all（默认 all）
func (s *ReviewService) Records(actor rbac.Actor, tab string, f repository.RecognitionFilter) (*dto.PageResult[dto.RecognitionListItem], error) {
	if !isReviewerRole(actor.Role) && actor.Role != model.RoleAdmin {
		return nil, ErrForbidden
	}
	switch tab {
	case "", "all":
		items, total, err := s.repo.ListSubmitted(actor, f)
		if err != nil {
			return nil, err
		}
		list, err := s.buildRecognitionListItems(items)
		if err != nil {
			return nil, err
		}
		return &dto.PageResult[dto.RecognitionListItem]{
			Items: list, Total: total, Page: f.Page, PageSize: f.PageSize,
		}, nil
	case "todo":
		return s.recordsTodo(actor, f)
	case "done":
		items, total, err := s.repo.ListReviewedByActor(actor, f)
		if err != nil {
			return nil, err
		}
		list, err := s.buildRecognitionListItems(items)
		if err != nil {
			return nil, err
		}
		return &dto.PageResult[dto.RecognitionListItem]{
			Items: list, Total: total, Page: f.Page, PageSize: f.PageSize,
		}, nil
	default:
		return nil, NewValidationError("tab 参数无效（可选：todo、done、all）")
	}
}

func (s *ReviewService) buildRecognitionListItems(items []model.RecognitionApplication) ([]dto.RecognitionListItem, error) {
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
	list := make([]dto.RecognitionListItem, 0, len(items))
	for i := range items {
		a := &items[i]
		stu := students[a.StudentID]
		list = append(list, dto.RecognitionListItem{
			ID:                    a.ID,
			StudentID:             a.StudentID,
			StudentNo:             stu.StudentNo,
			StudentName:           stu.Name,
			DeptName:              deptNames[stu.DeptID],
			MajorName:             majorNames[stu.MajorID],
			ClassName:             classNames[stu.ClassID],
			Year:                  a.Year,
			Status:                string(a.Status),
			CurrentLevel:          int(a.CurrentLevel),
			DifficultyLevel:       string(a.DifficultyLevel),
			PerCapitaAnnualIncome: a.PerCapitaAnnualIncome,
			SpecialTypes:          dto.SplitSpecialTypes(a.SpecialTypes),
		})
	}
	return list, nil
}

// isReviewerRole 是否为各级审核角色（不含 admin）。
func isReviewerRole(role model.Role) bool {
	switch role {
	case model.RoleClassAdvisor, model.RoleDepartment, model.RoleAidCenter:
		return true
	default:
		return false
	}
}

// Pass 通过：流转到下一级；可初定/调整困难等级；院级通过即认定通过。
func (s *ReviewService) Pass(actor rbac.Actor, id uint, req *dto.ReviewActionRequest) (*dto.RecognitionResponse, error) {
	a, level, err := s.loadActionable(actor, id)
	if err != nil {
		return nil, err
	}

	if diff := strings.TrimSpace(req.DifficultyLevel); diff != "" {
		if !isValidDifficulty(diff) {
			return nil, NewValidationError("困难等级取值无效")
		}
		a.DifficultyLevel = model.DifficultyLevel(diff)
	}
	// 班级评审通过须初定困难等级。
	if level == model.LevelClass && a.DifficultyLevel == "" {
		return nil, NewValidationError("班级评审通过时须初定困难等级")
	}

	next := passNextStatus[a.Status]
	if next == model.StatusApproved && a.DifficultyLevel == "" {
		return nil, NewValidationError("认定通过前须确定困难等级")
	}
	a.Status = next
	if next == model.StatusApproved {
		a.CurrentLevel = model.LevelCollege
	} else {
		a.CurrentLevel = statusLevel[next]
	}
	a.RejectReason = ""

	rec := &model.ReviewRecord{
		Level:           level,
		ReviewerID:      actor.UserID,
		Action:          model.ActionPass,
		Opinion:         strings.TrimSpace(req.Opinion),
		DifficultyLevel: a.DifficultyLevel,
	}
	if err := s.repo.Transition(a, rec); err != nil {
		return nil, err
	}
	return s.buildResponse(a.ID)
}

// Reject 退回：到学生（0）或更低级别（附退回意见）。
func (s *ReviewService) Reject(actor rbac.Actor, id uint, req *dto.ReviewActionRequest) (*dto.RecognitionResponse, error) {
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
		a.Status = model.StatusRejected
		a.CurrentLevel = 0
	} else {
		st, ok := levelStatus[target]
		if !ok {
			return nil, NewValidationError("退回级别无效")
		}
		a.Status = st
		a.CurrentLevel = target
	}
	a.RejectReason = opinion

	rec := &model.ReviewRecord{
		Level:         level,
		ReviewerID:    actor.UserID,
		Action:        model.ActionReject,
		Opinion:       opinion,
		RejectToLevel: target,
	}
	if err := s.repo.Transition(a, rec); err != nil {
		return nil, err
	}
	return s.buildResponse(a.ID)
}

// Withdraw 撤回本人最近一次评审意见（下级尚未审核时可撤销误操作）。
func (s *ReviewService) Withdraw(actor rbac.Actor, id uint) (*dto.RecognitionResponse, error) {
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

	pending, ok := levelStatus[last.Level]
	if !ok {
		return nil, NewValidationError("当前评审记录不可撤回")
	}
	a.Status = pending
	a.CurrentLevel = last.Level
	a.RejectReason = ""
	a.DifficultyLevel = difficultyAfterRemovingReview(a.Reviews, last.ID)

	if err := s.repo.RevertReview(a, last.ID); err != nil {
		return nil, err
	}
	return s.buildResponse(a.ID)
}

// Batch 批量评审：逐条执行 pass/reject，返回成功/失败明细（部分失败不阻断整体）。
func (s *ReviewService) Batch(actor rbac.Actor, req *dto.BatchReviewRequest) (*dto.BatchReviewResult, error) {
	action := model.ReviewAction(req.Action)
	if action != model.ActionPass && action != model.ActionReject {
		return nil, NewValidationError("评审动作无效（pass/reject）")
	}
	if len(req.IDs) == 0 {
		return nil, NewValidationError("请至少选择一条申请")
	}

	res := &dto.BatchReviewResult{Total: len(req.IDs)}
	for _, id := range req.IDs {
		var actErr error
		if action == model.ActionPass {
			_, actErr = s.Pass(actor, id, &dto.ReviewActionRequest{
				DifficultyLevel: req.DifficultyLevel,
				Opinion:         req.Opinion,
			})
		} else {
			_, actErr = s.Reject(actor, id, &dto.ReviewActionRequest{
				Opinion:       req.Opinion,
				RejectToLevel: req.RejectToLevel,
			})
		}
		item := dto.BatchReviewItemResult{ID: id, OK: actErr == nil}
		if actErr != nil {
			item.Message = errMessage(actErr)
			res.Failed++
		} else {
			res.Success++
		}
		res.Items = append(res.Items, item)
	}
	return res, nil
}

// ===== 内部辅助 =====

// loadActionable 加载申请并校验：在数据范围内、处于待审状态、当前角色有权评审该级别。
func (s *ReviewService) loadActionable(actor rbac.Actor, id uint) (*model.RecognitionApplication, model.ReviewLevel, error) {
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
	level, ok := statusLevel[a.Status]
	if !ok {
		return nil, 0, NewValidationError("当前状态不可评审")
	}
	if !roleCanActLevel(actor.Role, level) {
		return nil, 0, ErrForbidden
	}
	return a, level, nil
}

// buildResponse 重新加载申请并补充评审人姓名后返回详情响应。
func (s *ReviewService) buildResponse(id uint) (*dto.RecognitionResponse, error) {
	a, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	no, name := "", ""
	var stu *model.Student
	if found, sErr := s.stuRepo.FindStudentUnscoped(a.StudentID); sErr == nil {
		stu = found
		no, name = found.StudentNo, found.Name
	}
	resp := dto.ToRecognitionResponse(a, no, name)
	if stu != nil {
		resp.DeptName, resp.ClassName = studentOrgNames(s.orgRepo, stu)
	}
	resp.Reviews = s.reviewRecords(a.Reviews)
	return &resp, nil
}

func (s *ReviewService) reviewRecords(records []model.ReviewRecord) []dto.ReviewRecordResponse {
	if len(records) == 0 {
		return []dto.ReviewRecordResponse{}
	}
	ids := make([]uint, 0, len(records))
	for i := range records {
		ids = append(ids, records[i].ReviewerID)
	}
	names, err := s.userRepo.FindNamesByIDs(ids)
	if err != nil {
		names = map[uint]string{}
	}
	return dto.ToReviewRecordResponses(records, names)
}

func isValidDifficulty(s string) bool {
	switch model.DifficultyLevel(s) {
	case model.DifficultySpecial, model.DifficultyHard, model.DifficultyGeneral:
		return true
	default:
		return false
	}
}

func containsString(list []string, target string) bool {
	for _, v := range list {
		if v == target {
			return true
		}
	}
	return false
}

// difficultyAfterRemovingReview 移除指定评审记录后，取仍保留的最近一次通过所定困难等级。
func difficultyAfterRemovingReview(reviews []model.ReviewRecord, removeID uint) model.DifficultyLevel {
	for i := len(reviews) - 1; i >= 0; i-- {
		r := reviews[i]
		if r.ID == removeID {
			continue
		}
		if r.Action == model.ActionPass && r.DifficultyLevel != "" {
			return r.DifficultyLevel
		}
	}
	return ""
}

// errMessage 将业务错误转为可展示给用户的简短信息（用于批量结果）。
func errMessage(err error) string {
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
