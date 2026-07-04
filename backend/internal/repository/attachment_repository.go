package repository

import (
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"gorm.io/gorm"
)

// AttachmentRepository 附件数据访问。
type AttachmentRepository struct {
	db *gorm.DB
}

func NewAttachmentRepository(db *gorm.DB) *AttachmentRepository {
	return &AttachmentRepository{db: db}
}

func (r *AttachmentRepository) Create(a *model.Attachment) error {
	return r.db.Create(a).Error
}

func (r *AttachmentRepository) FindByID(id uint) (*model.Attachment, error) {
	var a model.Attachment
	if err := r.db.First(&a, id).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

// ListByOwner 按归属对象列出附件（如 recognition + appID）。
func (r *AttachmentRepository) ListByOwner(ownerType string, ownerID uint) ([]model.Attachment, error) {
	var items []model.Attachment
	err := r.db.Where("owner_type = ? AND owner_id = ?", ownerType, ownerID).
		Order("id desc").Find(&items).Error
	return items, err
}

func (r *AttachmentRepository) Delete(id uint) error {
	return deleteByID(r.db, &model.Attachment{}, id)
}
