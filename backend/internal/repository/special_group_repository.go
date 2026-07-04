package repository

import (
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"gorm.io/gorm"
)

// SpecialGroupRepository 重点保障人群名单数据访问。
type SpecialGroupRepository struct {
	db *gorm.DB
}

func NewSpecialGroupRepository(db *gorm.DB) *SpecialGroupRepository {
	return &SpecialGroupRepository{db: db}
}

// SpecialGroupFilter 重点人群列表过滤与分页条件。
type SpecialGroupFilter struct {
	Type     string
	Year     int
	Keyword  string // 姓名/学号/身份证模糊匹配
	Page     int
	PageSize int
}

func (r *SpecialGroupRepository) query(f SpecialGroupFilter) *gorm.DB {
	q := r.db.Model(&model.SpecialGroup{})
	if f.Type != "" {
		q = q.Where("type = ?", f.Type)
	}
	if f.Year > 0 {
		q = q.Where("year = ?", f.Year)
	}
	if f.Keyword != "" {
		kw := "%" + f.Keyword + "%"
		q = q.Where("name LIKE ? OR student_no LIKE ? OR id_card LIKE ?", kw, kw, kw)
	}
	return q
}

func (r *SpecialGroupRepository) List(f SpecialGroupFilter) ([]model.SpecialGroup, int64, error) {
	var total int64
	if err := r.query(f).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.SpecialGroup
	q := r.query(f).Order("id desc")
	if f.PageSize > 0 {
		q = q.Limit(f.PageSize).Offset((f.Page - 1) * f.PageSize)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *SpecialGroupRepository) Find(id uint) (*model.SpecialGroup, error) {
	var s model.SpecialGroup
	if err := r.db.First(&s, id).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *SpecialGroupRepository) Create(s *model.SpecialGroup) error {
	return r.db.Create(s).Error
}

func (r *SpecialGroupRepository) Save(s *model.SpecialGroup) error {
	return r.db.Save(s).Error
}

func (r *SpecialGroupRepository) Delete(id uint) error {
	return deleteByID(r.db, &model.SpecialGroup{}, id)
}

// MatchExists 判断是否存在匹配指定学号或身份证的重点人群记录。
func (r *SpecialGroupRepository) MatchExists(studentNo, idCard string) (bool, error) {
	if studentNo == "" && idCard == "" {
		return false, nil
	}
	q := r.db.Model(&model.SpecialGroup{})
	switch {
	case studentNo != "" && idCard != "":
		q = q.Where("student_no = ? OR id_card = ?", studentNo, idCard)
	case studentNo != "":
		q = q.Where("student_no = ?", studentNo)
	default:
		q = q.Where("id_card = ?", idCard)
	}
	var count int64
	if err := q.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// DupExists 判断是否已存在等价记录（同 学号/身份证 + 类型 + 年度），用于导入幂等。
func (r *SpecialGroupRepository) DupExists(studentNo, idCard, sgType string, year int) (bool, error) {
	q := r.db.Model(&model.SpecialGroup{}).Where("type = ? AND year = ?", sgType, year)
	switch {
	case studentNo != "" && idCard != "":
		q = q.Where("student_no = ? AND id_card = ?", studentNo, idCard)
	case studentNo != "":
		q = q.Where("student_no = ?", studentNo)
	case idCard != "":
		q = q.Where("id_card = ?", idCard)
	default:
		return false, nil
	}
	var count int64
	if err := q.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}
