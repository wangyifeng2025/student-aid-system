package model

// User 系统用户（学生与各级审核人员共用）
type User struct {
	BaseModel
	Username     string `gorm:"size:64;uniqueIndex;not null" json:"username"` // 学号/工号
	PasswordHash string `gorm:"size:255;not null" json:"-"`
	RealName     string `gorm:"size:64" json:"real_name"`
	Role         Role   `gorm:"size:32;index;not null" json:"role"`
	Phone        string `gorm:"size:20" json:"phone"`
	DeptID       *uint  `gorm:"index" json:"dept_id"`    // 所属院系（教学系审核人员的数据范围）
	Status       int    `gorm:"default:1" json:"status"` // 1 启用 0 禁用
}
