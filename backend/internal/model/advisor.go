package model

// Advisor 班主任信息（管理员维护的名册）。
// 一个班主任可管理多个班级；可选关联登录账号以便评审按多班过滤。
type Advisor struct {
	BaseModel
	DeptID  uint   `gorm:"index;not null" json:"dept_id"`
	StaffNo string `gorm:"size:64;uniqueIndex" json:"staff_no"` // 教工号，登录用户名
	Name    string `gorm:"size:64;not null;index" json:"name"`
	Phone   string `gorm:"size:20;index" json:"phone"`
	UserID  *uint  `gorm:"index" json:"user_id"`
}

func (Advisor) TableName() string { return "advisors" }

// AdvisorClass 班主任与班级的多对多关系。
type AdvisorClass struct {
	AdvisorID uint `gorm:"primaryKey" json:"advisor_id"`
	ClassID   uint `gorm:"primaryKey" json:"class_id"`
}

func (AdvisorClass) TableName() string { return "advisor_classes" }
