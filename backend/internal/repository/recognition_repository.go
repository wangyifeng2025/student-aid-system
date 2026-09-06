package repository

import (
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"gorm.io/gorm"
)

// RecognitionRepository 困难认定申请数据访问。
type RecognitionRepository struct {
	db *gorm.DB
}

func NewRecognitionRepository(db *gorm.DB) *RecognitionRepository {
	return &RecognitionRepository{db: db}
}

// RecognitionFilter 认定申请列表过滤与分页条件。
type RecognitionFilter struct {
	Year            int
	Status          string
	Keyword         string // 学生姓名/学号
	SpecialType     string // 申请表勾选的特殊群体类型 code（命中即返回，可与其它勾选并存）
	DifficultyLevel string // 空=不限；none=未评定；其余为困难等级
	DeptID          uint   // 按院系筛选（资助中心/管理员）
	ClassID         uint   // 按班级筛选（教学系/资助中心）
	Page            int
	PageSize        int
	ExcludeStatuses []string // 排除的状态（如 draft，供审核角色隐藏未提交申请）
	IDs             []uint   // 按申请 ID 限定（导出勾选记录）
}

// scoped 在 applications 关联 students 后按操作者数据范围过滤。
// 通过 JOIN students 实现 self/class/department/school 四级范围。
func (r *RecognitionRepository) scoped(actor rbac.Actor) *gorm.DB {
	q := r.db.Model(&model.RecognitionApplication{}).
		Joins("JOIN students ON students.id = recognition_applications.student_id")
	switch actor.Scope() {
	case rbac.ScopeSchool:
		// 全校：不附加条件
	case rbac.ScopeDepartment:
		if actor.DeptID != nil {
			q = q.Where("students.dept_id = ?", *actor.DeptID)
		} else {
			q = q.Where("1 = 0")
		}
	case rbac.ScopeClass:
		if ids := actor.ManagedClassIDs(); len(ids) > 0 {
			q = q.Where("students.class_id IN ?", ids)
		} else {
			q = q.Where("1 = 0")
		}
	case rbac.ScopeSelf:
		q = q.Where("students.user_id = ?", actor.UserID)
	default:
		q = q.Where("1 = 0")
	}
	return q
}

func applyRecognitionFilter(q *gorm.DB, f RecognitionFilter) *gorm.DB {
	if f.Year > 0 {
		q = q.Where("recognition_applications.year = ?", f.Year)
	}
	if f.Status != "" {
		q = q.Where("recognition_applications.status = ?", f.Status)
	}
	if f.Keyword != "" {
		kw := "%" + f.Keyword + "%"
		q = q.Where("students.name LIKE ? OR students.student_no LIKE ?", kw, kw)
	}
	if f.DeptID > 0 {
		q = q.Where("students.dept_id = ?", f.DeptID)
	}
	if f.ClassID > 0 {
		q = q.Where("students.class_id = ?", f.ClassID)
	}
	q = applySpecialTypeFilter(q, f.SpecialType)
	if dl := strings.TrimSpace(f.DifficultyLevel); dl != "" {
		if dl == "none" {
			q = q.Where("recognition_applications.difficulty_level = '' OR recognition_applications.difficulty_level IS NULL")
		} else if model.IsValidDifficultyLevel(dl) {
			q = q.Where("recognition_applications.difficulty_level = ?", dl)
		} else {
			q = q.Where("1 = 0")
		}
	}
	if len(f.ExcludeStatuses) > 0 {
		q = q.Where("recognition_applications.status NOT IN ?", f.ExcludeStatuses)
	}
	if len(f.IDs) > 0 {
		q = q.Where("recognition_applications.id IN ?", f.IDs)
	}
	return q
}

// applySpecialTypeFilter 按逗号分隔的 special_types 做精确 token 匹配（避免 poverty 命中 poverty_unstable）。
func applySpecialTypeFilter(q *gorm.DB, specialType string) *gorm.DB {
	t := strings.TrimSpace(specialType)
	if t == "" {
		return q
	}
	if !model.IsValidSpecialGroupType(t) {
		return q.Where("1 = 0")
	}
	escaped := strings.NewReplacer("!", "!!", "%", "!%", "_", "!_").Replace(t)
	return q.Where(
		"CONCAT(',', REPLACE(COALESCE(recognition_applications.special_types, ''), ' ', ''), ',') LIKE ? ESCAPE '!'",
		"%,"+escaped+",%",
	)
}

// List 按数据范围分页列出认定申请，返回当前页与总数。
func (r *RecognitionRepository) List(actor rbac.Actor, f RecognitionFilter) ([]model.RecognitionApplication, int64, error) {
	var total int64
	if err := applyRecognitionFilter(r.scoped(actor), f).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.RecognitionApplication
	q := applyRecognitionFilter(r.scoped(actor), f).
		Order("recognition_applications.id desc")
	if f.PageSize > 0 {
		q = q.Limit(f.PageSize).Offset((f.Page - 1) * f.PageSize)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// FindByID 按 ID 加载申请（含家庭成员与评审流转记录）。
func (r *RecognitionRepository) FindByID(id uint) (*model.RecognitionApplication, error) {
	var a model.RecognitionApplication
	if err := r.db.
		Preload("FamilyMembers").
		Preload("Reviews", func(db *gorm.DB) *gorm.DB { return db.Order("review_records.id asc") }).
		First(&a, id).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

// ListByStatuses 按数据范围 + 指定状态集合分页列出申请（评审待办）。
func (r *RecognitionRepository) ListByStatuses(actor rbac.Actor, statuses []string, f RecognitionFilter) ([]model.RecognitionApplication, int64, error) {
	if len(statuses) == 0 {
		return []model.RecognitionApplication{}, 0, nil
	}
	base := func() *gorm.DB {
		return applyRecognitionFilter(r.scoped(actor), f).
			Where("recognition_applications.status IN ?", statuses)
	}
	var total int64
	if err := base().Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.RecognitionApplication
	q := base().Order("recognition_applications.id asc")
	if f.PageSize > 0 {
		q = q.Limit(f.PageSize).Offset((f.Page - 1) * f.PageSize)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// ListReviewedByActor 列出数据范围内当前用户已评审过的申请（不含草稿）。
func (r *RecognitionRepository) ListReviewedByActor(actor rbac.Actor, f RecognitionFilter) ([]model.RecognitionApplication, int64, error) {
	f.ExcludeStatuses = append(f.ExcludeStatuses, string(model.StatusDraft))
	base := func() *gorm.DB {
		return applyRecognitionFilter(r.scoped(actor), f).
			Where(
				"EXISTS (SELECT 1 FROM review_records WHERE review_records.application_id = recognition_applications.id AND review_records.reviewer_id = ? AND review_records.deleted_at IS NULL)",
				actor.UserID,
			)
	}
	var total int64
	if err := base().Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.RecognitionApplication
	q := base().Order("recognition_applications.id desc")
	if f.PageSize > 0 {
		q = q.Limit(f.PageSize).Offset((f.Page - 1) * f.PageSize)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// ListSubmitted 列出数据范围内已提交（非草稿）的认定申请。
func (r *RecognitionRepository) ListSubmitted(actor rbac.Actor, f RecognitionFilter) ([]model.RecognitionApplication, int64, error) {
	f.ExcludeStatuses = append(f.ExcludeStatuses, string(model.StatusDraft))
	var total int64
	if err := applyRecognitionFilter(r.scoped(actor), f).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.RecognitionApplication
	q := applyRecognitionFilter(r.scoped(actor), f).
		Order("recognition_applications.id desc")
	if f.PageSize > 0 {
		q = q.Limit(f.PageSize).Offset((f.Page - 1) * f.PageSize)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// RevertReview 撤回一条评审记录并回滚申请流程字段（同事务）。
func (r *RecognitionRepository) RevertReview(a *model.RecognitionApplication, reviewID uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(a).Select(
			"status", "current_level", "difficulty_level", "reject_reason",
		).Updates(a).Error; err != nil {
			return err
		}
		return tx.Delete(&model.ReviewRecord{}, reviewID).Error
	})
}

// Transition 在同一事务内更新申请流程字段并写入一条评审流转记录。
func (r *RecognitionRepository) Transition(a *model.RecognitionApplication, rec *model.ReviewRecord) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(a).Select(
			"status", "current_level", "difficulty_level", "reject_reason",
		).Updates(a).Error; err != nil {
			return err
		}
		rec.ApplicationID = a.ID
		return tx.Create(rec).Error
	})
}

// CanAccess 判断操作者是否在数据范围内可访问指定申请。
func (r *RecognitionRepository) CanAccess(actor rbac.Actor, id uint) (bool, error) {
	var count int64
	if err := r.scoped(actor).
		Where("recognition_applications.id = ?", id).
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// ExistsByStudentYear 判断某学生某学年是否已有申请（excludeID 排除自身）。
func (r *RecognitionRepository) ExistsByStudentYear(studentID uint, year int, excludeID uint) (bool, error) {
	q := r.db.Model(&model.RecognitionApplication{}).
		Where("student_id = ? AND year = ?", studentID, year)
	if excludeID > 0 {
		q = q.Where("id <> ?", excludeID)
	}
	var count int64
	if err := q.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// Create 创建申请及其家庭成员（同事务）。
func (r *RecognitionRepository) Create(a *model.RecognitionApplication) error {
	return r.db.Create(a).Error
}

// SaveWithMembers 更新申请主体并整体替换家庭成员（同事务）。
func (r *RecognitionRepository) SaveWithMembers(a *model.RecognitionApplication, members []model.FamilyMember) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 替换家庭成员：先删旧，再插新
		if err := tx.Where("application_id = ?", a.ID).Delete(&model.FamilyMember{}).Error; err != nil {
			return err
		}
		for i := range members {
			members[i].ID = 0
			members[i].ApplicationID = a.ID
		}
		if len(members) > 0 {
			if err := tx.Create(&members).Error; err != nil {
				return err
			}
		}
		// 保存主体（Select 全字段，确保零值如 reject_reason 清空也写入）
		if err := tx.Session(&gorm.Session{FullSaveAssociations: false}).
			Omit("FamilyMembers").Save(a).Error; err != nil {
			return err
		}
		a.FamilyMembers = members
		return nil
	})
}

// Delete 软删除申请、家庭成员与评审记录。
func (r *RecognitionRepository) Delete(id uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("application_id = ?", id).Delete(&model.FamilyMember{}).Error; err != nil {
			return err
		}
		if err := tx.Where("application_id = ?", id).Delete(&model.ReviewRecord{}).Error; err != nil {
			return err
		}
		return tx.Delete(&model.RecognitionApplication{}, id).Error
	})
}

// UpdateStatusFields 仅更新流程相关字段（提交/退回等）。
func (r *RecognitionRepository) UpdateStatusFields(a *model.RecognitionApplication) error {
	return r.db.Model(a).Select(
		"status", "current_level", "difficulty_level", "reject_reason", "per_capita_annual_income",
	).Updates(a).Error
}
