package service

import (
	"fmt"
	"math"
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/validate"
	"gorm.io/gorm"
)

// RecognitionService 困难认定申请业务逻辑（填报、校验、草稿、提交）。
type RecognitionService struct {
	repo     *repository.RecognitionRepository
	stuRepo  *repository.StudentRepository
	orgRepo  *repository.OrgRepository
	dictRepo *repository.DictRepository
	userRepo *repository.UserRepository
	attRepo  *repository.AttachmentRepository
}

func NewRecognitionService(db *gorm.DB) *RecognitionService {
	return &RecognitionService{
		repo:     repository.NewRecognitionRepository(db),
		stuRepo:  repository.NewStudentRepository(db),
		orgRepo:  repository.NewOrgRepository(db),
		dictRepo: repository.NewDictRepository(db),
		userRepo: repository.NewUserRepository(db),
		attRepo:  repository.NewAttachmentRepository(db),
	}
}

// 与前端约定一致的签字附件文件名。
const studentSignatureFile = "student_signature.png"

// List 按数据范围分页列出认定申请。
func (s *RecognitionService) List(actor rbac.Actor, f repository.RecognitionFilter) (*dto.PageResult[dto.RecognitionListItem], error) {
	if isReviewerRole(actor.Role) {
		f.ExcludeStatuses = []string{string(model.StatusDraft)}
	}
	items, total, err := s.repo.List(actor, f)
	if err != nil {
		return nil, err
	}
	// 批量补充学号/姓名
	ids := make([]uint, 0, len(items))
	for i := range items {
		ids = append(ids, items[i].StudentID)
	}
	students, err := s.stuRepo.FindMapByIDs(ids)
	if err != nil {
		return nil, err
	}
	// 批量预加载院系/专业/班级名称（按 ID 解析）
	deptNames, majorNames, classNames, err := s.orgNameMaps()
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
		})
	}
	return &dto.PageResult[dto.RecognitionListItem]{
		Items:    list,
		Total:    total,
		Page:     f.Page,
		PageSize: f.PageSize,
	}, nil
}

// orgNameMaps 预加载院系/专业/班级 ID -> 名称映射，用于列表展示。
func (s *RecognitionService) orgNameMaps() (map[uint]string, map[uint]string, map[uint]string, error) {
	return buildOrgNameMaps(s.orgRepo)
}

// Get 加载详情（按数据范围校验访问权）。
func (s *RecognitionService) Get(actor rbac.Actor, id uint) (*dto.RecognitionResponse, error) {
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
	if isReviewerRole(actor.Role) && a.Status == model.StatusDraft {
		return nil, ErrNotFound
	}
	no, name := s.studentBrief(a.StudentID)
	resp := dto.ToRecognitionResponse(a, no, name)
	resp.Reviews = s.reviewRecords(a.Reviews)
	return &resp, nil
}

// reviewRecords 将评审记录补充评审人姓名后转为响应。
func (s *RecognitionService) reviewRecords(records []model.ReviewRecord) []dto.ReviewRecordResponse {
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

// Create 学生本人创建认定申请（草稿）。
func (s *RecognitionService) Create(actor rbac.Actor, req *dto.RecognitionRequest) (*dto.RecognitionResponse, error) {
	if actor.Role != model.RoleStudent {
		return nil, ErrForbidden
	}
	stu, err := s.stuRepo.FindByUserID(actor.UserID)
	if repository.IsNotFound(err) {
		return nil, NewValidationError("当前账号未关联学生档案，无法填报")
	}
	if err != nil {
		return nil, err
	}
	exists, err := s.repo.ExistsByStudentYear(stu.ID, req.Year, 0)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrDuplicate
	}
	applyStudentIDCard(req, stu)
	if err := s.validateFormat(req); err != nil {
		return nil, err
	}

	a := &model.RecognitionApplication{StudentID: stu.ID, Status: model.StatusDraft}
	applyRecognition(a, req)
	a.FamilyMembers = buildMembers(req.FamilyMembers)
	if err := s.repo.Create(a); err != nil {
		return nil, err
	}
	resp := dto.ToRecognitionResponse(a, stu.StudentNo, stu.Name)
	return &resp, nil
}

// Update 学生本人修改草稿/被退回的申请（整体替换家庭成员）。
func (s *RecognitionService) Update(actor rbac.Actor, id uint, req *dto.RecognitionRequest) (*dto.RecognitionResponse, error) {
	a, stu, err := s.loadOwned(actor, id)
	if err != nil {
		return nil, err
	}
	if !isEditable(a.Status) {
		return nil, NewValidationError("当前状态不可修改（仅草稿或被退回的申请可编辑）")
	}
	if req.Year != a.Year {
		exists, err := s.repo.ExistsByStudentYear(a.StudentID, req.Year, a.ID)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, ErrDuplicate
		}
	}
	applyStudentIDCard(req, stu)
	if err := s.validateFormat(req); err != nil {
		return nil, err
	}

	applyRecognition(a, req)
	// 编辑被退回的申请：回到草稿，清空退回意见
	if a.Status == model.StatusRejected {
		a.Status = model.StatusDraft
		a.CurrentLevel = 0
		a.RejectReason = ""
	}
	members := buildMembers(req.FamilyMembers)
	if err := s.repo.SaveWithMembers(a, members); err != nil {
		return nil, err
	}
	resp := dto.ToRecognitionResponse(a, stu.StudentNo, stu.Name)
	return &resp, nil
}

// Delete 学生本人删除未提交的申请（草稿/被退回）。
func (s *RecognitionService) Delete(actor rbac.Actor, id uint) error {
	a, _, err := s.loadOwned(actor, id)
	if err != nil {
		return err
	}
	if !isDeletable(a) {
		return NewValidationError("当前状态不可删除（仅草稿、被退回，或已提交但班级尚未审核的申请可删除）")
	}
	return s.repo.Delete(id)
}

// Withdraw 学生本人撤回已提交但尚未经班级审核的申请，恢复为草稿。
func (s *RecognitionService) Withdraw(actor rbac.Actor, id uint) (*dto.RecognitionResponse, error) {
	a, stu, err := s.loadOwned(actor, id)
	if err != nil {
		return nil, err
	}
	if !isWithdrawable(a) {
		return nil, NewValidationError("当前状态不可撤回（仅待班级评审且班主任尚未审核时可撤回）")
	}
	a.Status = model.StatusDraft
	a.CurrentLevel = 0
	a.DifficultyLevel = ""
	a.RejectReason = ""
	if err := s.repo.UpdateStatusFields(a); err != nil {
		return nil, err
	}
	resp := dto.ToRecognitionResponse(a, stu.StudentNo, stu.Name)
	return &resp, nil
}

// Submit 提交评审：完整校验 + 自动计算人均收入 + 单亲/单薪提示。
func (s *RecognitionService) Submit(actor rbac.Actor, id uint) (*dto.SubmitResult, error) {
	a, stu, err := s.loadOwned(actor, id)
	if err != nil {
		return nil, err
	}
	if !isEditable(a.Status) {
		return nil, NewValidationError("当前状态不可提交（仅草稿或被退回的申请可提交）")
	}
	if err := validateForSubmit(a); err != nil {
		return nil, err
	}
	if err := s.requireSignatureAttachments(id); err != nil {
		return nil, err
	}

	// 自动计算家庭人均年收入（服务端为准）
	a.PerCapitaAnnualIncome = computePerCapita(a)
	a.Status = model.StatusPendingClass
	a.CurrentLevel = model.LevelClass
	a.RejectReason = ""
	if err := s.repo.UpdateStatusFields(a); err != nil {
		return nil, err
	}

	resp := dto.ToRecognitionResponse(a, stu.StudentNo, stu.Name)
	return &dto.SubmitResult{
		Application: &resp,
		Warnings:    buildWarnings(a),
	}, nil
}

// ===== 内部辅助 =====

// loadOwned 加载申请并校验为当前学生本人所有（含成员预载）。
func (s *RecognitionService) loadOwned(actor rbac.Actor, id uint) (*model.RecognitionApplication, *model.Student, error) {
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

func (s *RecognitionService) studentBrief(studentID uint) (no, name string) {
	stu, err := s.stuRepo.FindStudent(studentID)
	if err != nil {
		return "", ""
	}
	return stu.StudentNo, stu.Name
}

// validateFormat 对已填字段做格式与字典校验（草稿与提交共用）。
func (s *RecognitionService) validateFormat(req *dto.RecognitionRequest) error {
	idCard := strings.ToUpper(strings.TrimSpace(req.IDCard))
	if idCard != "" && !validate.IDCard(idCard) {
		return NewValidationError("身份证号格式不正确（需为 18 位有效号码）")
	}
	if req.Phone != "" && !validate.Phone(req.Phone) {
		return NewValidationError("手机号格式不正确")
	}
	if req.GuardianPhone != "" && !validate.Phone(req.GuardianPhone) {
		return NewValidationError("家长手机号格式不正确")
	}
	if req.HouseholdType != "" &&
		req.HouseholdType != string(model.HouseholdUrban) &&
		req.HouseholdType != string(model.HouseholdRural) {
		return NewValidationError("户口类型取值无效")
	}
	if err := s.requireDict("nation", req.Nation, "民族"); err != nil {
		return err
	}
	if err := s.requireDict("income_source", req.IncomeSource, "收入来源"); err != nil {
		return err
	}
	for _, t := range req.SpecialTypes {
		if !model.IsValidSpecialGroupType(strings.TrimSpace(t)) {
			return NewValidationError("特殊群体类型取值无效：" + t)
		}
	}
	for i, m := range req.FamilyMembers {
		idx := i + 1
		if err := s.requireDict("relation", m.Relation, fmt.Sprintf("第%d位家庭成员的与学生关系", idx)); err != nil {
			return err
		}
		if err := s.requireDict("occupation", m.Occupation, fmt.Sprintf("第%d位家庭成员的职业", idx)); err != nil {
			return err
		}
		if err := s.requireDict("health_status", m.Health, fmt.Sprintf("第%d位家庭成员的健康状况", idx)); err != nil {
			return err
		}
		if m.SpecialType != "" && !model.IsValidSpecialGroupType(strings.TrimSpace(m.SpecialType)) {
			return NewValidationError(fmt.Sprintf("第%d位家庭成员的特殊群体类型取值无效", idx))
		}
	}
	return nil
}

// requireDict 非空时要求命中字典项。
func (s *RecognitionService) requireDict(dictType, code, label string) error {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil
	}
	ok, err := s.dictRepo.ExistsByTypeCode(dictType, code)
	if err != nil {
		return err
	}
	if !ok {
		return NewValidationError(label + "取值无效（须为字典中的编码）")
	}
	return nil
}

// applyStudentIDCard 认定申请身份证号一律取自学籍档案，忽略前端传入值。
func applyStudentIDCard(req *dto.RecognitionRequest, stu *model.Student) {
	req.IDCard = stu.IDCard
}

// applyRecognition 将请求写入模型主体（不含家庭成员、流程字段）。
func applyRecognition(a *model.RecognitionApplication, req *dto.RecognitionRequest) {
	a.Year = req.Year
	a.Nation = strings.TrimSpace(req.Nation)
	a.NativePlace = strings.TrimSpace(req.NativePlace)
	a.IDCard = strings.ToUpper(strings.TrimSpace(req.IDCard))
	a.FamilyPopulation = req.FamilyPopulation
	a.Phone = strings.TrimSpace(req.Phone)
	a.Address = strings.TrimSpace(req.Address)
	a.PostalCode = strings.TrimSpace(req.PostalCode)
	a.GuardianPhone = strings.TrimSpace(req.GuardianPhone)
	a.HouseholdType = model.HouseholdType(req.HouseholdType)
	a.PerCapitaAnnualIncome = req.PerCapitaAnnualIncome
	a.IncomeSource = strings.TrimSpace(req.IncomeSource)
	a.SpecialTypes = dto.JoinSpecialTypes(req.SpecialTypes)
	a.NaturalDisaster = strings.TrimSpace(req.NaturalDisaster)
	a.SuddenAccident = strings.TrimSpace(req.SuddenAccident)
	a.WeakLabor = strings.TrimSpace(req.WeakLabor)
	a.Unemployment = strings.TrimSpace(req.Unemployment)
	a.Debt = strings.TrimSpace(req.Debt)
	a.OtherInfo = strings.TrimSpace(req.OtherInfo)
	a.CommitmentAgreed = req.CommitmentAgreed
}

func buildMembers(items []dto.FamilyMemberInput) []model.FamilyMember {
	out := make([]model.FamilyMember, 0, len(items))
	for _, m := range items {
		out = append(out, model.FamilyMember{
			Name:         strings.TrimSpace(m.Name),
			Age:          m.Age,
			Relation:     strings.TrimSpace(m.Relation),
			WorkUnit:     strings.TrimSpace(m.WorkUnit),
			Occupation:   strings.TrimSpace(m.Occupation),
			AnnualIncome: m.AnnualIncome,
			Health:       strings.TrimSpace(m.Health),
			SpecialType:  strings.TrimSpace(m.SpecialType),
		})
	}
	return out
}

// isEditable 草稿或被退回时可编辑/提交。
func isEditable(status model.ApplicationStatus) bool {
	return status == model.StatusDraft || status == model.StatusRejected
}

// isDeletable 草稿/退回，或已提交但班级尚未审核时可删除。
func isDeletable(a *model.RecognitionApplication) bool {
	if isEditable(a.Status) {
		return true
	}
	return isWithdrawable(a)
}

// isWithdrawable 已提交且班级尚未审核时可撤回。
func isWithdrawable(a *model.RecognitionApplication) bool {
	if a.Status != model.StatusPendingClass {
		return false
	}
	for _, rec := range a.Reviews {
		if rec.Level == model.LevelClass {
			return false
		}
	}
	return true
}

// validateForSubmit 提交前的完整性与逻辑校验。
func validateForSubmit(a *model.RecognitionApplication) error {
	if strings.TrimSpace(a.Nation) == "" {
		return NewValidationError("请填写民族")
	}
	if strings.TrimSpace(a.NativePlace) == "" {
		return NewValidationError("请填写籍贯")
	}
	if a.IDCard == "" || !validate.IDCard(a.IDCard) {
		return NewValidationError("请填写有效的 18 位身份证号")
	}
	if a.Phone == "" || !validate.Phone(a.Phone) {
		return NewValidationError("请填写有效的手机号")
	}
	if strings.TrimSpace(a.Address) == "" {
		return NewValidationError("请填写详细通讯地址")
	}
	if a.HouseholdType != model.HouseholdUrban && a.HouseholdType != model.HouseholdRural {
		return NewValidationError("请选择户口类型（城镇/农村）")
	}
	if a.FamilyPopulation < 1 {
		return NewValidationError("家庭人口至少为 1")
	}
	// 家庭成员数应为“家庭人口 - 1”（不含学生本人）
	if len(a.FamilyMembers) != a.FamilyPopulation-1 {
		return NewValidationError(fmt.Sprintf(
			"家庭成员人数应为 %d 人（家庭人口 %d 减去学生本人），当前填写了 %d 人",
			a.FamilyPopulation-1, a.FamilyPopulation, len(a.FamilyMembers)))
	}
	// 健康状况为“残疾”时，其他情况必须说明
	for _, m := range a.FamilyMembers {
		if m.Health == "disabled" && strings.TrimSpace(a.OtherInfo) == "" {
			return NewValidationError("家庭成员存在残疾，请在“其他情况”中补充说明")
		}
	}
	// 未勾选任何特殊群体类型时，其他情况必须说明困难原因
	if strings.TrimSpace(a.SpecialTypes) == "" && strings.TrimSpace(a.OtherInfo) == "" {
		return NewValidationError("未勾选特殊群体类型时，请在“其他情况”中说明家庭经济困难原因")
	}
	if !a.CommitmentAgreed {
		return NewValidationError("请先勾选个人承诺")
	}
	return nil
}

// requireSignatureAttachments 提交前须已上传学生本人（或监护人）签字图。
func (s *RecognitionService) requireSignatureAttachments(appID uint) error {
	items, err := s.attRepo.ListByOwner(OwnerTypeRecognition, appID)
	if err != nil {
		return err
	}
	hasSignature := false
	for i := range items {
		if items[i].FileName == studentSignatureFile {
			hasSignature = true
			break
		}
	}
	if !hasSignature {
		return NewValidationError("请完成学生本人（或监护人）签字后再提交")
	}
	return nil
}

// computePerCapita 由家庭成员年收入合计与家庭人口计算人均年收入（保留两位）。
func computePerCapita(a *model.RecognitionApplication) float64 {
	if a.FamilyPopulation <= 0 {
		return 0
	}
	var total float64
	for _, m := range a.FamilyMembers {
		total += m.AnnualIncome
	}
	v := total / float64(a.FamilyPopulation)
	return math.Round(v*100) / 100
}

// buildWarnings 生成单亲/单薪等非阻断性提示。
func buildWarnings(a *model.RecognitionApplication) []string {
	warnings := make([]string, 0, 2)
	parents := 0
	parentsWithIncome := 0
	for _, m := range a.FamilyMembers {
		if m.Relation == "father" || m.Relation == "mother" {
			parents++
			if m.AnnualIncome > 0 {
				parentsWithIncome++
			}
		}
	}
	switch {
	case parents == 1:
		warnings = append(warnings, "检测到单亲家庭（父母仅一方在家庭成员中），请确认是否属实，并留意单亲家庭相关资助政策。")
	case parents >= 2 && parentsWithIncome <= 1:
		warnings = append(warnings, "检测到单薪家庭（父母中仅一方有收入），请确认是否属实。")
	}
	return warnings
}
