package model

import "time"

// Attachment 附件（支撑材料：住院/低保/灾情证明等）
type Attachment struct {
	BaseModel
	OwnerType  string `gorm:"size:32;index" json:"owner_type"` // recognition / grant 等
	OwnerID    uint   `gorm:"index" json:"owner_id"`
	FileName   string `gorm:"size:255" json:"file_name"`
	Path       string `gorm:"size:512" json:"path"`
	Size       int64  `json:"size"`
	Mime       string `gorm:"size:128" json:"mime"`
	UploaderID uint   `gorm:"index" json:"uploader_id"`
}

// Publicity 公示
type Publicity struct {
	BaseModel
	Type    string     `gorm:"size:32;index" json:"type"` // recognition / grant
	Title   string     `gorm:"size:255" json:"title"`
	Content string     `gorm:"type:text" json:"content"`
	StartAt *time.Time `json:"start_at"`
	EndAt   *time.Time `json:"end_at"`
	Status  int        `gorm:"default:1" json:"status"` // 1 进行中 0 结束
}

// Dict 数据字典（前端下拉来源，统一约束）
type Dict struct {
	BaseModel
	Type  string `gorm:"size:64;index;not null" json:"type"` // nation / relation / occupation ...
	Code  string `gorm:"size:64;index" json:"code"`
	Label string `gorm:"size:128" json:"label"`
	Sort  int    `gorm:"default:0" json:"sort"`
}

// Notification 站内通知
type Notification struct {
	BaseModel
	UserID  uint   `gorm:"index" json:"user_id"`
	Title   string `gorm:"size:255" json:"title"`
	Content string `gorm:"type:text" json:"content"`
	IsRead  bool   `gorm:"default:false;index" json:"is_read"`
}

// AuditLog 操作审计日志
type AuditLog struct {
	BaseModel
	UserID uint   `gorm:"index" json:"user_id"`
	Action string `gorm:"size:64" json:"action"`
	Target string `gorm:"size:128" json:"target"`
	Detail string `gorm:"type:text" json:"detail"`
	IP     string `gorm:"size:64" json:"ip"`
}
