package repository

import (
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"gorm.io/gorm"
)

// AdvisorFilter 班主任列表筛选。
type AdvisorFilter struct {
	DeptID   uint
	Keyword  string
	IDs      []uint
	Page     int
	PageSize int
}

// AdvisorRepository 班主任名册数据访问。
type AdvisorRepository struct {
	db *gorm.DB
}

func NewAdvisorRepository(db *gorm.DB) *AdvisorRepository {
	return &AdvisorRepository{db: db}
}

func (r *AdvisorRepository) List(f AdvisorFilter) ([]model.Advisor, int64, error) {
	q := r.db.Model(&model.Advisor{})
	if f.DeptID > 0 {
		q = q.Where("dept_id = ?", f.DeptID)
	}
	if kw := strings.TrimSpace(f.Keyword); kw != "" {
		like := "%" + kw + "%"
		q = q.Where("name LIKE ? OR phone LIKE ? OR staff_no LIKE ?", like, like, like)
	}
	if len(f.IDs) > 0 {
		q = q.Where("id IN ?", f.IDs)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.Advisor
	listQ := q.Order("id desc")
	if f.PageSize > 0 {
		page := f.Page
		if page < 1 {
			page = 1
		}
		listQ = listQ.Offset((page - 1) * f.PageSize).Limit(f.PageSize)
	}
	err := listQ.Find(&items).Error
	return items, total, err
}

func (r *AdvisorRepository) FindByID(id uint) (*model.Advisor, error) {
	var a model.Advisor
	if err := r.db.First(&a, id).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *AdvisorRepository) FindByUserID(userID uint) (*model.Advisor, error) {
	var a model.Advisor
	if err := r.db.Where("user_id = ?", userID).First(&a).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *AdvisorRepository) FindByStaffNo(staffNo string, excludeID uint) (*model.Advisor, error) {
	var a model.Advisor
	q := r.db.Where("staff_no = ?", staffNo)
	if excludeID > 0 {
		q = q.Where("id <> ?", excludeID)
	}
	if err := q.First(&a).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *AdvisorRepository) FindByStaffNoUnscoped(staffNo string) (*model.Advisor, error) {
	var a model.Advisor
	if err := r.db.Unscoped().Where("staff_no = ?", staffNo).First(&a).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *AdvisorRepository) Restore(a *model.Advisor) error {
	if a == nil || a.ID == 0 {
		return gorm.ErrRecordNotFound
	}
	a.DeletedAt = gorm.DeletedAt{}
	return r.db.Unscoped().Save(a).Error
}

func (r *AdvisorRepository) ReviewerHasRecords(userID uint) (bool, error) {
	if userID == 0 {
		return false, nil
	}
	var n int64
	if err := r.db.Model(&model.ReviewRecord{}).Where("reviewer_id = ?", userID).Count(&n).Error; err != nil {
		return false, err
	}
	if n > 0 {
		return true, nil
	}
	if err := r.db.Model(&model.GrantReviewRecord{}).Where("reviewer_id = ?", userID).Count(&n).Error; err != nil {
		return false, err
	}
	return n > 0, nil
}

func (r *AdvisorRepository) StaffNoExists(staffNo string, excludeID uint) (bool, error) {
	var count int64
	q := r.db.Model(&model.Advisor{}).Where("staff_no = ?", staffNo)
	if excludeID > 0 {
		q = q.Where("id <> ?", excludeID)
	}
	if err := q.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *AdvisorRepository) Create(a *model.Advisor) error {
	return r.db.Create(a).Error
}

func (r *AdvisorRepository) Save(a *model.Advisor) error {
	return r.db.Save(a).Error
}

func (r *AdvisorRepository) Delete(a *model.Advisor) error {
	if a == nil || a.ID == 0 {
		return gorm.ErrRecordNotFound
	}
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("advisor_id = ?", a.ID).Delete(&model.AdvisorClass{}).Error; err != nil {
			return err
		}
		if a.UserID != nil && *a.UserID > 0 {
			uid := *a.UserID
			if err := tx.Model(&model.Class{}).Where("advisor_id = ?", uid).Update("advisor_id", nil).Error; err != nil {
				return err
			}
			var u model.User
			if err := tx.Unscoped().First(&u, uid).Error; err == nil {
				if u.Role == model.RoleClassAdvisor {
					if err := tx.Unscoped().Delete(&model.User{}, uid).Error; err != nil {
						return err
					}
				}
			} else if err != gorm.ErrRecordNotFound {
				return err
			}
		}
		return hardDeleteByID(tx, &model.Advisor{}, a.ID)
	})
}

func (r *AdvisorRepository) ListClassIDs(advisorID uint) ([]uint, error) {
	var links []model.AdvisorClass
	if err := r.db.Where("advisor_id = ?", advisorID).Find(&links).Error; err != nil {
		return nil, err
	}
	ids := make([]uint, 0, len(links))
	for i := range links {
		ids = append(ids, links[i].ClassID)
	}
	return ids, nil
}

func (r *AdvisorRepository) ListClassIDsByUserID(userID uint) ([]uint, error) {
	if userID == 0 {
		return nil, nil
	}
	m, err := r.ListClassIDsByUserIDs([]uint{userID})
	if err != nil {
		return nil, err
	}
	return m[userID], nil
}

func (r *AdvisorRepository) ListClassIDsByUserIDs(userIDs []uint) (map[uint][]uint, error) {
	out := make(map[uint][]uint, len(userIDs))
	if len(userIDs) == 0 {
		return out, nil
	}
	type row struct {
		UserID  uint
		ClassID uint
	}
	var rows []row
	err := r.db.Table("advisor_classes").
		Select("advisors.user_id AS user_id, advisor_classes.class_id AS class_id").
		Joins("JOIN advisors ON advisors.id = advisor_classes.advisor_id").
		Where("advisors.user_id IN ? AND advisors.deleted_at IS NULL", userIDs).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for i := range rows {
		uid := rows[i].UserID
		out[uid] = append(out[uid], rows[i].ClassID)
	}
	return out, nil
}

func (r *AdvisorRepository) ReplaceClasses(advisorID uint, classIDs []uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("advisor_id = ?", advisorID).Delete(&model.AdvisorClass{}).Error; err != nil {
			return err
		}
		seen := map[uint]struct{}{}
		for _, id := range classIDs {
			if id == 0 {
				continue
			}
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			if err := tx.Create(&model.AdvisorClass{AdvisorID: advisorID, ClassID: id}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *AdvisorRepository) ListAll() ([]model.Advisor, error) {
	var items []model.Advisor
	err := r.db.Order("dept_id, id").Find(&items).Error
	return items, err
}

// AssignClass 将班级划给指定班主任（一个班只属于一位班主任）。
func (r *AdvisorRepository) AssignClass(advisorID, classID uint) error {
	if advisorID == 0 || classID == 0 {
		return nil
	}
	var n int64
	if err := r.db.Model(&model.AdvisorClass{}).
		Where("advisor_id = ? AND class_id = ?", advisorID, classID).
		Count(&n).Error; err != nil {
		return err
	}
	if n == 0 {
		if err := r.db.Create(&model.AdvisorClass{AdvisorID: advisorID, ClassID: classID}).Error; err != nil {
			return err
		}
	}
	return r.KeepOnlyAdvisorForClass(advisorID, classID)
}

// KeepOnlyAdvisorForClass 去掉其他班主任对该班的管理关系。
func (r *AdvisorRepository) KeepOnlyAdvisorForClass(advisorID, classID uint) error {
	return r.db.Where("class_id = ? AND advisor_id <> ?", classID, advisorID).
		Delete(&model.AdvisorClass{}).Error
}

// UnlinkClass 班级删除或取消班主任时清掉名册关系。
func (r *AdvisorRepository) UnlinkClass(classID uint) error {
	return r.db.Where("class_id = ?", classID).Delete(&model.AdvisorClass{}).Error
}

// FindByClassIDs 按班级查出班主任名册（一班一位）。
func (r *AdvisorRepository) FindByClassIDs(classIDs []uint) (map[uint]model.Advisor, error) {
	out := make(map[uint]model.Advisor)
	if len(classIDs) == 0 {
		return out, nil
	}
	var links []model.AdvisorClass
	if err := r.db.Where("class_id IN ?", classIDs).Find(&links).Error; err != nil {
		return nil, err
	}
	if len(links) == 0 {
		return out, nil
	}
	ids := make([]uint, 0, len(links))
	for i := range links {
		ids = append(ids, links[i].AdvisorID)
	}
	var advisors []model.Advisor
	if err := r.db.Where("id IN ?", ids).Find(&advisors).Error; err != nil {
		return nil, err
	}
	byID := make(map[uint]model.Advisor, len(advisors))
	for i := range advisors {
		byID[advisors[i].ID] = advisors[i]
	}
	for i := range links {
		if a, ok := byID[links[i].AdvisorID]; ok {
			out[links[i].ClassID] = a
		}
	}
	return out, nil
}

// FindByUserIDs 按登录账号 ID 查出班主任名册。
func (r *AdvisorRepository) FindByUserIDs(userIDs []uint) (map[uint]model.Advisor, error) {
	out := make(map[uint]model.Advisor)
	if len(userIDs) == 0 {
		return out, nil
	}
	var items []model.Advisor
	if err := r.db.Where("user_id IN ?", userIDs).Find(&items).Error; err != nil {
		return nil, err
	}
	for i := range items {
		if items[i].UserID != nil {
			out[*items[i].UserID] = items[i]
		}
	}
	return out, nil
}

func (r *AdvisorRepository) ListClassIDsByAdvisorIDs(advisorIDs []uint) (map[uint][]uint, error) {
	out := make(map[uint][]uint, len(advisorIDs))
	if len(advisorIDs) == 0 {
		return out, nil
	}
	var links []model.AdvisorClass
	if err := r.db.Where("advisor_id IN ?", advisorIDs).Find(&links).Error; err != nil {
		return nil, err
	}
	for i := range links {
		out[links[i].AdvisorID] = append(out[links[i].AdvisorID], links[i].ClassID)
	}
	return out, nil
}
