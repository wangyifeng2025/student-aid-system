package repository

import (
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"gorm.io/gorm"
)

// GrantRepository 助学金申请数据访问。
type GrantRepository struct {
	db *gorm.DB
}

func NewGrantRepository(db *gorm.DB) *GrantRepository {
	return &GrantRepository{db: db}
}

// GrantFilter 助学金列表过滤。
type GrantFilter struct {
	Year            int
	Status          string
	GrantType       string
	Keyword         string
	DeptID          uint
	ClassID         uint
	Page            int
	PageSize        int
	ExcludeStatuses []string
}

func (r *GrantRepository) scoped(actor rbac.Actor) *gorm.DB {
	q := r.db.Model(&model.GrantApplication{}).
		Joins("JOIN students ON students.id = grant_applications.student_id")
	switch actor.Scope() {
	case rbac.ScopeSchool:
	case rbac.ScopeDepartment:
		if actor.DeptID != nil {
			q = q.Where("students.dept_id = ?", *actor.DeptID)
		} else {
			q = q.Where("1 = 0")
		}
	case rbac.ScopeClass:
		if actor.ClassID != nil {
			q = q.Where("students.class_id = ?", *actor.ClassID)
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

func applyGrantFilter(q *gorm.DB, f GrantFilter) *gorm.DB {
	if f.Year > 0 {
		q = q.Where("grant_applications.year = ?", f.Year)
	}
	if f.Status != "" {
		q = q.Where("grant_applications.status = ?", f.Status)
	}
	if f.GrantType != "" {
		q = q.Where("grant_applications.grant_type = ?", f.GrantType)
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
	if len(f.ExcludeStatuses) > 0 {
		q = q.Where("grant_applications.status NOT IN ?", f.ExcludeStatuses)
	}
	return q
}

func (r *GrantRepository) List(actor rbac.Actor, f GrantFilter) ([]model.GrantApplication, int64, error) {
	var total int64
	if err := applyGrantFilter(r.scoped(actor), f).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.GrantApplication
	q := applyGrantFilter(r.scoped(actor), f).Order("grant_applications.id desc")
	if f.PageSize > 0 {
		q = q.Limit(f.PageSize).Offset((f.Page - 1) * f.PageSize)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *GrantRepository) FindByID(id uint) (*model.GrantApplication, error) {
	var a model.GrantApplication
	if err := r.db.
		Preload("FamilyMembers").
		Preload("Reviews", func(db *gorm.DB) *gorm.DB { return db.Order("grant_review_records.id asc") }).
		First(&a, id).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *GrantRepository) ListByStatuses(actor rbac.Actor, statuses []string, f GrantFilter) ([]model.GrantApplication, int64, error) {
	if len(statuses) == 0 {
		return []model.GrantApplication{}, 0, nil
	}
	base := func() *gorm.DB {
		return applyGrantFilter(r.scoped(actor), f).
			Where("grant_applications.status IN ?", statuses)
	}
	var total int64
	if err := base().Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.GrantApplication
	q := base().Order("grant_applications.id asc")
	if f.PageSize > 0 {
		q = q.Limit(f.PageSize).Offset((f.Page - 1) * f.PageSize)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *GrantRepository) ListReviewedByActor(actor rbac.Actor, f GrantFilter) ([]model.GrantApplication, int64, error) {
	f.ExcludeStatuses = append(f.ExcludeStatuses, string(model.GrantStatusDraft))
	base := func() *gorm.DB {
		return applyGrantFilter(r.scoped(actor), f).
			Where(
				"EXISTS (SELECT 1 FROM grant_review_records WHERE grant_review_records.application_id = grant_applications.id AND grant_review_records.reviewer_id = ? AND grant_review_records.deleted_at IS NULL)",
				actor.UserID,
			)
	}
	var total int64
	if err := base().Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.GrantApplication
	q := base().Order("grant_applications.id desc")
	if f.PageSize > 0 {
		q = q.Limit(f.PageSize).Offset((f.Page - 1) * f.PageSize)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *GrantRepository) ListSubmitted(actor rbac.Actor, f GrantFilter) ([]model.GrantApplication, int64, error) {
	f.ExcludeStatuses = append(f.ExcludeStatuses, string(model.GrantStatusDraft))
	var total int64
	if err := applyGrantFilter(r.scoped(actor), f).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.GrantApplication
	q := applyGrantFilter(r.scoped(actor), f).Order("grant_applications.id desc")
	if f.PageSize > 0 {
		q = q.Limit(f.PageSize).Offset((f.Page - 1) * f.PageSize)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *GrantRepository) CanAccess(actor rbac.Actor, id uint) (bool, error) {
	var count int64
	if err := r.scoped(actor).Where("grant_applications.id = ?", id).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *GrantRepository) ExistsByStudentYearType(studentID uint, year int, grantType model.GrantType, excludeID uint) (bool, error) {
	q := r.db.Model(&model.GrantApplication{}).
		Where("student_id = ? AND year = ? AND grant_type = ?", studentID, year, grantType)
	if excludeID > 0 {
		q = q.Where("id <> ?", excludeID)
	}
	var count int64
	if err := q.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *GrantRepository) Create(a *model.GrantApplication) error {
	return r.db.Create(a).Error
}

func (r *GrantRepository) SaveWithMembers(a *model.GrantApplication, members []model.GrantFamilyMember) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("application_id = ?", a.ID).Delete(&model.GrantFamilyMember{}).Error; err != nil {
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
		if err := tx.Session(&gorm.Session{FullSaveAssociations: false}).
			Omit("FamilyMembers", "Reviews").Save(a).Error; err != nil {
			return err
		}
		a.FamilyMembers = members
		return nil
	})
}

func (r *GrantRepository) UpdateStatusFields(a *model.GrantApplication) error {
	return r.db.Model(a).Select(
		"status", "current_level", "reject_reason",
	).Updates(a).Error
}

func (r *GrantRepository) Delete(id uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("application_id = ?", id).Delete(&model.GrantFamilyMember{}).Error; err != nil {
			return err
		}
		if err := tx.Where("application_id = ?", id).Delete(&model.GrantReviewRecord{}).Error; err != nil {
			return err
		}
		return tx.Delete(&model.GrantApplication{}, id).Error
	})
}

func (r *GrantRepository) Transition(a *model.GrantApplication, rec *model.GrantReviewRecord) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(a).Select("status", "current_level", "reject_reason").Updates(a).Error; err != nil {
			return err
		}
		rec.ApplicationID = a.ID
		return tx.Create(rec).Error
	})
}

func (r *GrantRepository) RevertReview(a *model.GrantApplication, reviewID uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(a).Select("status", "current_level", "reject_reason").Updates(a).Error; err != nil {
			return err
		}
		return tx.Delete(&model.GrantReviewRecord{}, reviewID).Error
	})
}
