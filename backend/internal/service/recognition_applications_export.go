package service

import (
	"strconv"
	"strings"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/xuri/excelize/v2"
)

const (
	recognitionAppsSheet     = "申请明细"
	recognitionMembersSheet  = "家庭成员"
	recognitionReviewsSheet  = "评审记录"
	recognitionAppsFileName  = "学院困难认定申请明细.xlsx"
	recognitionAppsASCIIName = "college_applications.xlsx"
)

// ExportApplications 导出数据范围内已提交认定申请的完整数据（不含草稿）。
// 仅资助中心（院级）与管理员可调用。
// scope 与审核页签一致：todo=本级待办，done=本人已办理，all=当前筛选下全部已提交。传入 IDs 时只导出勾选记录。
func (s *RecognitionSummaryExportService) ExportApplications(actor rbac.Actor, f repository.RecognitionFilter, scope string) ([]byte, string, string, error) {
	if actor.Role != model.RoleAidCenter && actor.Role != model.RoleAdmin {
		return nil, "", "", ErrForbidden
	}
	if f.Status == string(model.StatusDraft) {
		return nil, "", "", NewValidationError("不能导出草稿")
	}

	items, err := s.loadApplicationExportItems(actor, f, scope)
	if err != nil {
		return nil, "", "", err
	}

	stuIDs := make([]uint, 0, len(items))
	appIDs := make([]uint, 0, len(items))
	for i := range items {
		stuIDs = append(stuIDs, items[i].StudentID)
		appIDs = append(appIDs, items[i].ID)
	}
	students, err := s.stuRepo.FindMapByIDs(stuIDs)
	if err != nil {
		return nil, "", "", err
	}
	deptNames, majorNames, classNames, err := buildOrgNameMaps(s.orgRepo)
	if err != nil {
		return nil, "", "", err
	}
	gradeByClass, err := s.classGradeNames()
	if err != nil {
		return nil, "", "", err
	}
	labels := s.loadApplicationLabelMaps()
	members, err := s.repo.ListFamilyMembers(appIDs)
	if err != nil {
		return nil, "", "", err
	}
	reviews, err := s.repo.ListReviewRecords(appIDs)
	if err != nil {
		return nil, "", "", err
	}
	reviewerIDs := make([]uint, 0, len(reviews))
	for i := range reviews {
		if reviews[i].ReviewerID > 0 {
			reviewerIDs = append(reviewerIDs, reviews[i].ReviewerID)
		}
	}
	reviewerNames, err := s.userRepo.FindNamesByIDs(reviewerIDs)
	if err != nil {
		return nil, "", "", err
	}

	membersByApp := map[uint][]model.FamilyMember{}
	for i := range members {
		id := members[i].ApplicationID
		membersByApp[id] = append(membersByApp[id], members[i])
	}
	reviewsByApp := map[uint][]model.ReviewRecord{}
	for i := range reviews {
		id := reviews[i].ApplicationID
		reviewsByApp[id] = append(reviewsByApp[id], reviews[i])
	}

	appRows := make([][]any, 0, len(items))
	memberRows := make([][]any, 0, len(members))
	reviewRows := make([][]any, 0, len(reviews))
	for i := range items {
		a := &items[i]
		stu := students[a.StudentID]
		appRows = append(appRows, recognitionApplicationRow(a, stu, deptNames, majorNames, classNames, gradeByClass, labels))
		for _, m := range membersByApp[a.ID] {
			memberRows = append(memberRows, recognitionMemberRow(a, stu, m, labels))
		}
		for _, rv := range reviewsByApp[a.ID] {
			reviewRows = append(reviewRows, recognitionReviewRow(a, stu, rv, reviewerNames))
		}
	}

	file := excelize.NewFile()
	defer file.Close()
	file.SetSheetName("Sheet1", recognitionAppsSheet)
	if _, err := file.NewSheet(recognitionMembersSheet); err != nil {
		return nil, "", "", err
	}
	if _, err := file.NewSheet(recognitionReviewsSheet); err != nil {
		return nil, "", "", err
	}
	if err := writePlainSheet(file, recognitionAppsSheet, recognitionApplicationHeaders, appRows); err != nil {
		return nil, "", "", err
	}
	if err := writePlainSheet(file, recognitionMembersSheet, recognitionMemberHeaders, memberRows); err != nil {
		return nil, "", "", err
	}
	if err := writePlainSheet(file, recognitionReviewsSheet, recognitionReviewHeaders, reviewRows); err != nil {
		return nil, "", "", err
	}
	buf, err := file.WriteToBuffer()
	if err != nil {
		return nil, "", "", err
	}
	return buf.Bytes(), recognitionAppsFileName, recognitionAppsASCIIName, nil
}

func (s *RecognitionSummaryExportService) loadApplicationExportItems(actor rbac.Actor, f repository.RecognitionFilter, scope string) ([]model.RecognitionApplication, error) {
	f.Page = 0
	f.PageSize = 0
	if len(f.IDs) > 0 {
		f.Status = ""
		f.ExcludeStatuses = []string{string(model.StatusDraft)}
		items, _, err := s.repo.List(actor, f)
		return items, err
	}
	switch strings.ToLower(strings.TrimSpace(scope)) {
	case "todo":
		statuses := todoStatusesForRole(actor.Role)
		if len(statuses) == 0 {
			return nil, ErrForbidden
		}
		if f.Status != "" {
			if !containsString(statuses, f.Status) {
				return nil, NewValidationError("无权导出该状态的认定记录")
			}
			statuses = []string{f.Status}
			f.Status = ""
		}
		items, _, err := s.repo.ListByStatuses(actor, statuses, f)
		return items, err
	case "done":
		f.ExcludeStatuses = append(f.ExcludeStatuses, string(model.StatusDraft))
		items, _, err := s.repo.ListReviewedByActor(actor, f)
		return items, err
	case "", "all":
		f.ExcludeStatuses = []string{string(model.StatusDraft)}
		items, _, err := s.repo.List(actor, f)
		return items, err
	default:
		return nil, NewValidationError("scope 参数无效（可选：todo、done、all）")
	}
}

func (s *RecognitionSummaryExportService) loadApplicationLabelMaps() labelMaps {
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

var recognitionApplicationHeaders = []string{
	"学号", "姓名", "性别", "院系", "专业", "班级", "年级",
	"认定年度", "状态", "当前评审级别", "困难等级", "是否重点人群",
	"民族", "籍贯", "身份证号", "手机号", "详细通讯地址", "邮政编码", "监护人电话",
	"家庭人口", "户籍类型", "家庭人均年收入", "收入来源", "特殊群体",
	"自然灾害", "突发意外事件", "残疾或年迈劳动力弱", "失业情况", "欠债情况", "其他情况",
	"已确认承诺", "退回原因", "创建时间", "更新时间",
}

var recognitionMemberHeaders = []string{
	"学号", "学生姓名", "认定年度", "成员姓名", "年龄", "与学生关系",
	"工作或学习单位", "职业", "年收入", "健康状况", "特殊群体",
}

var recognitionReviewHeaders = []string{
	"学号", "学生姓名", "认定年度", "评审级别", "评审人", "动作",
	"意见", "该级困难等级", "退回到", "评审时间",
}

func recognitionApplicationRow(
	a *model.RecognitionApplication,
	stu model.Student,
	deptNames, majorNames, classNames, gradeByClass map[uint]string,
	labels labelMaps,
) []any {
	return []any{
		stu.StudentNo,
		stu.Name,
		genderLabel(stu.Gender),
		deptNames[stu.DeptID],
		majorNames[stu.MajorID],
		classNames[stu.ClassID],
		gradeByClass[stu.ClassID],
		a.Year,
		recognitionStatusLabel(a.Status),
		recognitionLevelLabel(a.CurrentLevel),
		difficultyLabel(string(a.DifficultyLevel)),
		yesNo(stu.IsKeyGroup),
		labels.label("nation", firstNonEmpty(a.Nation, stu.Nation)),
		a.NativePlace,
		firstNonEmpty(a.IDCard, stu.IDCard),
		firstNonEmpty(a.Phone, stu.Phone),
		a.Address,
		a.PostalCode,
		a.GuardianPhone,
		a.FamilyPopulation,
		householdLabel(a.HouseholdType),
		formatMoney(a.PerCapitaAnnualIncome),
		labels.label("income_source", a.IncomeSource),
		labels.joinSpecial(a.SpecialTypes),
		a.NaturalDisaster,
		a.SuddenAccident,
		a.WeakLabor,
		a.Unemployment,
		a.Debt,
		a.OtherInfo,
		yesNo(a.CommitmentAgreed),
		a.RejectReason,
		formatTime(a.CreatedAt),
		formatTime(a.UpdatedAt),
	}
}

func recognitionMemberRow(a *model.RecognitionApplication, stu model.Student, m model.FamilyMember, labels labelMaps) []any {
	special := ""
	if strings.TrimSpace(m.SpecialType) != "" {
		special = labels.label("special_group_type", m.SpecialType)
	}
	return []any{
		stu.StudentNo,
		stu.Name,
		a.Year,
		m.Name,
		m.Age,
		labels.label("relation", m.Relation),
		m.WorkUnit,
		labels.label("occupation", m.Occupation),
		formatMoney(m.AnnualIncome),
		labels.label("health_status", m.Health),
		special,
	}
}

func recognitionReviewRow(a *model.RecognitionApplication, stu model.Student, rv model.ReviewRecord, reviewerNames map[uint]string) []any {
	return []any{
		stu.StudentNo,
		stu.Name,
		a.Year,
		recognitionLevelLabel(rv.Level),
		reviewerNames[rv.ReviewerID],
		reviewActionLabel(rv.Action),
		rv.Opinion,
		difficultyLabel(string(rv.DifficultyLevel)),
		rejectTargetLabel(rv.Action, rv.RejectToLevel),
		formatTime(rv.CreatedAt),
	}
}

func writePlainSheet(f *excelize.File, sheet string, headers []string, rows [][]any) error {
	for i, h := range headers {
		cell, err := excelize.CoordinatesToCellName(i+1, 1)
		if err != nil {
			return err
		}
		if err := f.SetCellValue(sheet, cell, h); err != nil {
			return err
		}
	}
	for r, row := range rows {
		for c, v := range row {
			cell, err := excelize.CoordinatesToCellName(c+1, r+2)
			if err != nil {
				return err
			}
			if err := f.SetCellValue(sheet, cell, v); err != nil {
				return err
			}
		}
	}
	_ = f.SetPanes(sheet, &excelize.Panes{Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: "bottomLeft"})
	return nil
}

func recognitionStatusLabel(s model.ApplicationStatus) string {
	switch s {
	case model.StatusDraft:
		return "草稿"
	case model.StatusPendingClass:
		return "待班级评审"
	case model.StatusPendingDept:
		return "待教学系评审"
	case model.StatusPendingCollege:
		return "待院级评审"
	case model.StatusPendingFinal:
		return "待院级评审（历史）"
	case model.StatusApproved:
		return "认定通过"
	case model.StatusRejected:
		return "已退回"
	default:
		return string(s)
	}
}

func recognitionLevelLabel(level model.ReviewLevel) string {
	switch level {
	case model.LevelClass:
		return "班级评审"
	case model.LevelDepartment:
		return "教学系评审"
	case model.LevelCollege:
		return "院级评审"
	case model.LevelFinal:
		return "院级评审（历史）"
	default:
		return ""
	}
}

func difficultyLabel(code string) string {
	switch model.DifficultyLevel(code) {
	case model.DifficultySpecial:
		return "特别困难"
	case model.DifficultyHard:
		return "困难"
	case model.DifficultyGeneral:
		return "一般困难"
	default:
		return ""
	}
}

func householdLabel(t model.HouseholdType) string {
	switch t {
	case model.HouseholdUrban:
		return "城镇"
	case model.HouseholdRural:
		return "农村"
	default:
		return string(t)
	}
}

func reviewActionLabel(a model.ReviewAction) string {
	switch a {
	case model.ActionPass:
		return "通过"
	case model.ActionReject:
		return "退回"
	default:
		return string(a)
	}
}

func rejectTargetLabel(action model.ReviewAction, level model.ReviewLevel) string {
	if action != model.ActionReject {
		return ""
	}
	if level == 0 {
		return "学生重填"
	}
	return recognitionLevelLabel(level)
}

func yesNo(v bool) string {
	if v {
		return "是"
	}
	return "否"
}

func formatMoney(v float64) string {
	if v == 0 {
		return "0"
	}
	return strconv.FormatFloat(v, 'f', 2, 64)
}

func formatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format("2006-01-02 15:04")
}
