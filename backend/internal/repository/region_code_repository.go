package repository

import (
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"gorm.io/gorm"
)

// RegionCodeRepository 行政区划数据访问。
type RegionCodeRepository struct {
	db *gorm.DB
}

func NewRegionCodeRepository(db *gorm.DB) *RegionCodeRepository {
	return &RegionCodeRepository{db: db}
}

// RegionCodeFilter 列表筛选。
type RegionCodeFilter struct {
	ParentCode *string // nil 表示不按父级过滤；空串表示省级（无父级）
	Keyword    string
	Level      int
}

func (r *RegionCodeRepository) List(f RegionCodeFilter) ([]model.RegionCode, error) {
	q := r.db.Model(&model.RegionCode{})
	if f.Keyword != "" {
		kw := "%" + f.Keyword + "%"
		q = q.Where("name LIKE ? OR code LIKE ? OR id_prefix LIKE ?", kw, kw, kw)
	} else if f.ParentCode != nil {
		q = q.Where("parent_code = ?", *f.ParentCode)
	}
	if f.Level > 0 {
		q = q.Where("level = ?", f.Level)
	}
	var items []model.RegionCode
	err := q.Order("sort, code").Find(&items).Error
	return items, err
}

func (r *RegionCodeRepository) FindByCode(code string) (*model.RegionCode, error) {
	var item model.RegionCode
	if err := r.db.Where("code = ?", code).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *RegionCodeRepository) FindByIDPrefix(prefix string) (*model.RegionCode, error) {
	var item model.RegionCode
	if err := r.db.Where("id_prefix = ?", prefix).Order("level desc").First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *RegionCodeRepository) CountChildren(parentCode string) (int64, error) {
	var n int64
	err := r.db.Model(&model.RegionCode{}).Where("parent_code = ?", parentCode).Count(&n).Error
	return n, err
}

func (r *RegionCodeRepository) ChildCounts(parentCodes []string) (map[string]int64, error) {
	out := make(map[string]int64, len(parentCodes))
	if len(parentCodes) == 0 {
		return out, nil
	}
	type row struct {
		ParentCode string
		Cnt        int64
	}
	var rows []row
	err := r.db.Model(&model.RegionCode{}).
		Select("parent_code, count(*) as cnt").
		Where("parent_code IN ?", parentCodes).
		Group("parent_code").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, x := range rows {
		out[x.ParentCode] = x.Cnt
	}
	return out, nil
}

func (r *RegionCodeRepository) Create(item *model.RegionCode) error {
	return r.db.Create(item).Error
}

func (r *RegionCodeRepository) Save(item *model.RegionCode) error {
	return r.db.Save(item).Error
}

func (r *RegionCodeRepository) DeleteByCode(code string) error {
	result := r.db.Where("code = ?", code).Delete(&model.RegionCode{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *RegionCodeRepository) Count() (int64, error) {
	var n int64
	err := r.db.Model(&model.RegionCode{}).Count(&n).Error
	return n, err
}

func (r *RegionCodeRepository) UpsertByCode(item *model.RegionCode) (created bool, err error) {
	var existing model.RegionCode
	err = r.db.Unscoped().Where("code = ?", item.Code).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		return true, r.db.Create(item).Error
	}
	if err != nil {
		return false, err
	}
	existing.Name = item.Name
	existing.Level = item.Level
	existing.Type = item.Type
	existing.ParentCode = item.ParentCode
	existing.IDPrefix = item.IDPrefix
	existing.Sort = item.Sort
	existing.DeletedAt = gorm.DeletedAt{}
	return false, r.db.Unscoped().Save(&existing).Error
}
