package model

import (
	"time"

	"gorm.io/gorm"
)

// BaseModel 公共字段，所有表内嵌。
type BaseModel struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// AllModels 返回所有需要自动迁移的模型，供 database.AutoMigrate 使用。
func AllModels() []any {
	return []any{
		&User{},
		&Department{},
		&Major{},
		&Grade{},
		&Class{},
		&Student{},
		&SpecialGroup{},
		&RecognitionApplication{},
		&FamilyMember{},
		&ReviewRecord{},
		&GrantApplication{},
		&GrantFamilyMember{},
		&GrantReviewRecord{},
		&Attachment{},
		&Publicity{},
		&Quota{},
		&Dict{},
		&Notification{},
		&AuditLog{},
	}
}
