package repository

import (
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"gorm.io/gorm"
)

// DictRepository 数据字典数据访问。
type DictRepository struct {
	db *gorm.DB
}

func NewDictRepository(db *gorm.DB) *DictRepository {
	return &DictRepository{db: db}
}

// ListTypes 返回所有去重后的字典类型。
func (r *DictRepository) ListTypes() ([]string, error) {
	var types []string
	err := r.db.Model(&model.Dict{}).Distinct().Order("type").Pluck("type", &types).Error
	return types, err
}

// ListByType 按类型返回字典项，按 sort、id 排序。
func (r *DictRepository) ListByType(t string) ([]model.Dict, error) {
	var items []model.Dict
	err := r.db.Where("type = ?", t).Order("sort, id").Find(&items).Error
	return items, err
}

func (r *DictRepository) FindByTypeCode(t, code string) (*model.Dict, error) {
	var d model.Dict
	if err := r.db.Where("type = ? AND code = ?", t, code).First(&d).Error; err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *DictRepository) ExistsByTypeCode(t, code string) (bool, error) {
	var count int64
	if err := r.db.Model(&model.Dict{}).Where("type = ? AND code = ?", t, code).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *DictRepository) Create(d *model.Dict) error {
	return r.db.Create(d).Error
}

func (r *DictRepository) Save(d *model.Dict) error {
	return r.db.Save(d).Error
}

func (r *DictRepository) DeleteByTypeCode(t, code string) error {
	result := r.db.Where("type = ? AND code = ?", t, code).Delete(&model.Dict{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
