package model

// Department 院系
type Department struct {
	BaseModel
	Name string `gorm:"size:128;not null" json:"name"`
	Code string `gorm:"size:64;index" json:"code"`
}

// Major 专业
type Major struct {
	BaseModel
	DeptID uint   `gorm:"index;not null" json:"dept_id"`
	Name   string `gorm:"size:128;not null" json:"name"`
	Code   string `gorm:"size:64;index" json:"code"`
}

// Grade 年级
type Grade struct {
	BaseModel
	Name string `gorm:"size:32;not null" json:"name"` // 如 2024 级
	Year int    `gorm:"index" json:"year"`
}

// Class 班级
type Class struct {
	BaseModel
	DeptID    uint   `gorm:"index;not null" json:"dept_id"`
	MajorID   uint   `gorm:"index" json:"major_id"`
	GradeID   uint   `gorm:"index" json:"grade_id"`
	Name      string `gorm:"size:128;not null" json:"name"`
	AdvisorID *uint  `gorm:"index" json:"advisor_id"` // 班主任/辅导员 User.ID
}
