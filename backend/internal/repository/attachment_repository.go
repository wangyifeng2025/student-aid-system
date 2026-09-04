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

// CountProofByOwnerIDs 统计各归属对象的非签字证明材料份数。
func (r *AttachmentRepository) CountProofByOwnerIDs(ownerType string, ownerIDs []uint) (map[uint]int64, error) {
	out := map[uint]int64{}
	if len(ownerIDs) == 0 {
		return out, nil
	}
	type row struct {
		OwnerID uint  `gorm:"column:owner_id"`
		Cnt     int64 `gorm:"column:cnt"`
	}
	var rows []row
	err := r.db.Model(&model.Attachment{}).
		Select("owner_id, count(*) AS cnt").
		Where("owner_type = ? AND owner_id IN ?", ownerType, ownerIDs).
		Where("file_name NOT IN ?", []string{"student_signature.png", "commitment_handwriting.png"}).
		Group("owner_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for i := range rows {
		out[rows[i].OwnerID] = rows[i].Cnt
	}
	return out, nil
}

func (r *AttachmentRepository) Delete(id uint) error {
	return deleteByID(r.db, &model.Attachment{}, id)
}
