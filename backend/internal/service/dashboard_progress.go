package service

import (
	"fmt"
	"sort"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/xuri/excelize/v2"
)

// reviewProgress 按院系、班级汇总当前学年仍在审核中的认定申请。
// 待院级含历史 pending_final。没有待审的院系不返回。
func (s *DashboardService) reviewProgress(year int) ([]dto.DashboardDeptProgress, error) {
	rows, err := s.recRepo.CountPendingByOrg(year)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return []dto.DashboardDeptProgress{}, nil
	}
	deptNames, _, classNames, err := buildOrgNameMaps(s.orgRepo)
	if err != nil {
		return nil, err
	}

	type classKey struct {
		deptID  uint
		classID uint
	}
	classes := map[classKey]*dto.DashboardClassProgress{}
	order := make([]classKey, 0)
	for _, row := range rows {
		key := classKey{deptID: row.DeptID, classID: row.ClassID}
		item, ok := classes[key]
		if !ok {
			name := classNames[row.ClassID]
			if name == "" {
				name = "未分班"
			}
			item = &dto.DashboardClassProgress{ClassID: row.ClassID, ClassName: name}
			classes[key] = item
			order = append(order, key)
		}
		addPendingCount(row.Status, row.Count, &item.PendingClass, &item.PendingDept, &item.PendingCollege)
		item.Total += row.Count
	}

	byDept := map[uint]*dto.DashboardDeptProgress{}
	deptOrder := make([]uint, 0)
	for _, key := range order {
		dept, ok := byDept[key.deptID]
		if !ok {
			name := deptNames[key.deptID]
			if name == "" {
				name = "未分院系"
			}
			dept = &dto.DashboardDeptProgress{DeptID: key.deptID, DeptName: name, Classes: []dto.DashboardClassProgress{}}
			byDept[key.deptID] = dept
			deptOrder = append(deptOrder, key.deptID)
		}
		cls := *classes[key]
		dept.Classes = append(dept.Classes, cls)
		dept.PendingClass += cls.PendingClass
		dept.PendingDept += cls.PendingDept
		dept.PendingCollege += cls.PendingCollege
		dept.Total += cls.Total
	}

	out := make([]dto.DashboardDeptProgress, 0, len(deptOrder))
	for _, id := range deptOrder {
		dept := byDept[id]
		sort.Slice(dept.Classes, func(i, j int) bool {
			if dept.Classes[i].Total != dept.Classes[j].Total {
				return dept.Classes[i].Total > dept.Classes[j].Total
			}
			return dept.Classes[i].ClassName < dept.Classes[j].ClassName
		})
		out = append(out, *dept)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Total != out[j].Total {
			return out[i].Total > out[j].Total
		}
		return out[i].DeptName < out[j].DeptName
	})
	return out, nil
}

// ExportReviewProgress 导出当前学年各系、各班认定待审人数。仅资助中心与管理员可调用。
func (s *DashboardService) ExportReviewProgress(actor rbac.Actor, year int) ([]byte, string, string, error) {
	if actor.Role != model.RoleAidCenter && actor.Role != model.RoleAdmin {
		return nil, "", "", ErrForbidden
	}
	if year <= 0 {
		year = time.Now().Year()
	}
	progress, err := s.reviewProgress(year)
	if err != nil {
		return nil, "", "", err
	}
	rows := make([][]any, 0, len(progress)*2+1)
	var classN, deptN, collegeN, total int64
	for i := range progress {
		dept := &progress[i]
		rows = append(rows, reviewProgressExportRow(dept.DeptName, "合计", dept.PendingClass, dept.PendingDept, dept.PendingCollege, dept.Total))
		for j := range dept.Classes {
			cls := &dept.Classes[j]
			rows = append(rows, reviewProgressExportRow(dept.DeptName, cls.ClassName, cls.PendingClass, cls.PendingDept, cls.PendingCollege, cls.Total))
		}
		classN += dept.PendingClass
		deptN += dept.PendingDept
		collegeN += dept.PendingCollege
		total += dept.Total
	}
	rows = append(rows, reviewProgressExportRow("全校", "合计", classN, deptN, collegeN, total))

	file := excelize.NewFile()
	defer file.Close()
	file.SetSheetName("Sheet1", "各系待审")
	if err := writePlainSheet(file, "各系待审", []string{"院系", "班级", "待班级", "待教学系", "待院级", "合计"}, rows); err != nil {
		return nil, "", "", err
	}
	buf, err := file.WriteToBuffer()
	if err != nil {
		return nil, "", "", err
	}
	name := fmt.Sprintf("%d学年各系认定待审.xlsx", year)
	return buf.Bytes(), name, "review_progress.xlsx", nil
}

func reviewProgressExportRow(deptName, className string, pendingClass, pendingDept, pendingCollege, total int64) []any {
	return []any{deptName, className, pendingClass, pendingDept, pendingCollege, total}
}

func addPendingCount(status string, n int64, classN, deptN, collegeN *int64) {
	switch model.ApplicationStatus(status) {
	case model.StatusPendingClass:
		*classN += n
	case model.StatusPendingDept:
		*deptN += n
	case model.StatusPendingCollege, model.StatusPendingFinal:
		*collegeN += n
	}
}
