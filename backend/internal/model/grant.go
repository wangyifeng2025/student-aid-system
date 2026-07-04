package model

// GrantApplication 资助申请（国家助学金/励志奖学金等），数据可从认定表自动拆分预填
type GrantApplication struct {
	BaseModel
	StudentID     uint        `gorm:"index;not null" json:"student_id"`
	RecognitionID uint        `gorm:"index;not null" json:"recognition_id"` // 关联的认定申请（先认定后资助）
	GrantType     GrantType   `gorm:"size:32;index" json:"grant_type"`
	Year          int         `gorm:"index" json:"year"`
	Amount        float64     `json:"amount"` // 资助金额/档次
	Status        GrantStatus `gorm:"size:16;index;default:'draft'" json:"status"`
	Reason        string      `gorm:"size:1024" json:"reason"` // 申请理由
	AuditOpinion  string      `gorm:"size:512" json:"audit_opinion"`
}

// Quota 名额/预算（按上级指标分配）
type Quota struct {
	BaseModel
	Year      int       `gorm:"index" json:"year"`
	GrantType GrantType `gorm:"size:32;index" json:"grant_type"`
	Scope     string    `gorm:"size:128" json:"scope"` // 适用范围（全校/某系/某班）
	Total     int       `json:"total"`                 // 总名额
	Used      int       `json:"used"`                  // 已使用
	Budget    float64   `json:"budget"`                // 预算金额
}
