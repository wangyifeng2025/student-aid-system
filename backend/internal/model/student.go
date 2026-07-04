package model

import "time"

// Student 学生信息
type Student struct {
	BaseModel
	UserID          *uint      `gorm:"uniqueIndex" json:"user_id"` // 未关联登录账号时为 NULL（避免 0 触发唯一约束冲突）
	StudentNo       string     `gorm:"size:64;uniqueIndex;not null" json:"student_no"`
	Name            string     `gorm:"size:64;not null" json:"name"`
	Gender          string     `gorm:"size:8" json:"gender"`
	Birth           *time.Time `json:"birth"`
	Nation          string     `gorm:"size:32" json:"nation"`                       // 民族
	PoliticalStatus string     `gorm:"size:32" json:"political_status"`             // 政治面貌
	IDCard          string     `gorm:"size:18;uniqueIndex;not null" json:"id_card"` // 身份证号，全局唯一
	Phone           string     `gorm:"size:20" json:"phone"`
	EnrollTime      *time.Time `json:"enroll_time"` // 入学时间
	DeptID          uint       `gorm:"index" json:"dept_id"`
	MajorID         uint       `gorm:"index" json:"major_id"`
	ClassID         uint       `gorm:"index" json:"class_id"`
	IsKeyGroup      bool       `gorm:"default:false" json:"is_key_group"` // 是否重点保障人群（匹配命中）
}

// SpecialGroup 重点保障人群名单（由民政/乡村振兴等导入，用于自动匹配提醒）
type SpecialGroup struct {
	BaseModel
	StudentNo string           `gorm:"size:64;index" json:"student_no"`
	IDCard    string           `gorm:"size:18;index" json:"id_card"`
	Name      string           `gorm:"size:64" json:"name"`
	Type      SpecialGroupType `gorm:"size:32;index" json:"type"`
	Source    string           `gorm:"size:64" json:"source"` // 数据来源（民政/乡村振兴局等）
	Batch     string           `gorm:"size:64" json:"batch"`  // 导入批次
	Year      int              `gorm:"index" json:"year"`
}
