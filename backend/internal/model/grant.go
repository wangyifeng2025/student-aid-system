package model

// GrantApplication 国家助学金等资助申请（数据从认定表预填，先认定后资助）。
type GrantApplication struct {
	BaseModel
	StudentID     uint      `gorm:"index;not null" json:"student_id"`
	RecognitionID uint      `gorm:"index;not null" json:"recognition_id"`
	GrantType     GrantType `gorm:"size:32;index;not null" json:"grant_type"`
	Year          int       `gorm:"index;not null" json:"year"`

	Phone string `gorm:"size:20" json:"phone"`

	// 家庭经济（从认定表预填，学生可核对修改）
	HouseholdType            HouseholdType `gorm:"size:16" json:"household_type"`
	FamilyPopulation         int           `json:"family_population"`
	MonthlyIncome            float64       `json:"monthly_income"`              // 家庭月总收入
	PerCapitaMonthlyIncome   float64       `json:"per_capita_monthly_income"`   // 人均月收入
	IncomeSource             string        `gorm:"size:128" json:"income_source"`
	Address                  string        `gorm:"size:255" json:"address"`
	PostalCode               string        `gorm:"size:16" json:"postal_code"`

	Reason string `gorm:"size:1024" json:"reason"` // 申请理由

	Status       GrantStatus `gorm:"size:32;index;default:'draft'" json:"status"`
	CurrentLevel ReviewLevel `gorm:"default:0" json:"current_level"`
	RejectReason string      `gorm:"size:512" json:"reject_reason"`

	FamilyMembers []GrantFamilyMember `gorm:"foreignKey:ApplicationID" json:"family_members,omitempty"`
	Reviews       []GrantReviewRecord `gorm:"foreignKey:ApplicationID" json:"reviews,omitempty"`
}

// GrantFamilyMember 助学金申请表家庭成员（字段较认定表精简）。
type GrantFamilyMember struct {
	BaseModel
	ApplicationID uint   `gorm:"index;not null" json:"application_id"`
	Name          string `gorm:"size:64" json:"name"`
	Age           int    `json:"age"`
	Relation      string `gorm:"size:32" json:"relation"`
	WorkUnit      string `gorm:"size:255" json:"work_unit"`
}

// GrantReviewRecord 助学金评审流转记录。
type GrantReviewRecord struct {
	BaseModel
	ApplicationID uint            `gorm:"index;not null" json:"application_id"`
	Level         ReviewLevel     `gorm:"index" json:"level"`
	ReviewerID    uint            `gorm:"index" json:"reviewer_id"`
	Action        ReviewAction    `gorm:"size:16" json:"action"`
	Opinion       string          `gorm:"size:512" json:"opinion"`
	RejectToLevel ReviewLevel     `gorm:"default:0" json:"reject_to_level"`
}

// Quota 名额/预算（按上级指标分配，二期完善）。
type Quota struct {
	BaseModel
	Year      int       `gorm:"index" json:"year"`
	GrantType GrantType `gorm:"size:32;index" json:"grant_type"`
	Scope     string    `gorm:"size:128" json:"scope"`
	Total     int       `json:"total"`
	Used      int       `json:"used"`
	Budget    float64   `json:"budget"`
}
