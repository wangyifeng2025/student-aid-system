package model

// RecognitionApplication 家庭经济困难学生认定申请表
type RecognitionApplication struct {
	BaseModel
	StudentID uint `gorm:"index;not null" json:"student_id"`
	Year      int  `gorm:"index;not null" json:"year"` // 认定学年

	// 基本情况
	Nation           string `gorm:"size:32" json:"nation"`
	NativePlace      string `gorm:"size:128" json:"native_place"` // 籍贯（到市/县）
	IDCard           string `gorm:"size:18" json:"id_card"`
	FamilyPopulation int    `json:"family_population"` // 家庭人口
	Phone            string `gorm:"size:20" json:"phone"`
	Address          string `gorm:"size:255" json:"address"` // 详细通讯地址
	PostalCode       string `gorm:"size:16" json:"postal_code"`
	GuardianPhone    string `gorm:"size:20" json:"guardian_phone"`

	// 家庭经济情况
	HouseholdType         HouseholdType `gorm:"size:16" json:"household_type"` // 城镇/农村
	PerCapitaAnnualIncome float64       `json:"per_capita_annual_income"`      // 家庭人均年收入
	IncomeSource          string        `gorm:"size:128" json:"income_source"` // 收入来源

	// 特殊群体勾选（逗号分隔的 SpecialGroupType 集合）
	SpecialTypes string `gorm:"size:255" json:"special_types"`

	// 影响家庭经济状况有关信息（无则填"无"）
	NaturalDisaster string `gorm:"size:512" json:"natural_disaster"` // 自然灾害
	SuddenAccident  string `gorm:"size:512" json:"sudden_accident"`  // 突发意外事件
	WeakLabor       string `gorm:"size:512" json:"weak_labor"`       // 残疾/年迈劳动力弱
	Unemployment    string `gorm:"size:512" json:"unemployment"`     // 失业情况
	Debt            string `gorm:"size:512" json:"debt"`             // 欠债情况
	OtherInfo       string `gorm:"size:1024" json:"other_info"`      // 其他情况

	// 个人承诺（线上勾选记录，签字线下手写）
	CommitmentAgreed bool `gorm:"default:false" json:"commitment_agreed"`

	// 流程与结果
	Status          ApplicationStatus `gorm:"size:32;index;default:'draft'" json:"status"`
	CurrentLevel    ReviewLevel       `gorm:"default:0" json:"current_level"`  // 当前所处评审级别
	DifficultyLevel DifficultyLevel   `gorm:"size:16" json:"difficulty_level"` // 最终困难等级
	RejectReason    string            `gorm:"size:512" json:"reject_reason"`

	FamilyMembers []FamilyMember `gorm:"foreignKey:ApplicationID" json:"family_members,omitempty"`
	Reviews       []ReviewRecord `gorm:"foreignKey:ApplicationID" json:"reviews,omitempty"`
}

// FamilyMember 家庭成员
type FamilyMember struct {
	BaseModel
	ApplicationID uint    `gorm:"index;not null" json:"application_id"`
	Name          string  `gorm:"size:64" json:"name"`
	Age           int     `json:"age"`
	Relation      string  `gorm:"size:32" json:"relation"`     // 与学生关系（关系，非称呼）
	WorkUnit      string  `gorm:"size:255" json:"work_unit"`   // 工作/学习单位
	Occupation    string  `gorm:"size:16" json:"occupation"`   // 务工/务农/无/读书
	AnnualIncome  float64 `json:"annual_income"`               // 年收入
	Health        string  `gorm:"size:16" json:"health"`       // 良好/较差/残疾
	SpecialType   string  `gorm:"size:32" json:"special_type"` // 特殊群体类型
}

// ReviewRecord 评审记录（流转日志/审计）
type ReviewRecord struct {
	BaseModel
	ApplicationID   uint            `gorm:"index;not null" json:"application_id"`
	Level           ReviewLevel     `gorm:"index" json:"level"`
	ReviewerID      uint            `gorm:"index" json:"reviewer_id"`
	Action          ReviewAction    `gorm:"size:16" json:"action"`
	Opinion         string          `gorm:"size:512" json:"opinion"`
	DifficultyLevel DifficultyLevel `gorm:"size:16" json:"difficulty_level"`  // 该级定/调整的困难等级
	RejectToLevel   ReviewLevel     `gorm:"default:0" json:"reject_to_level"` // 退回到哪一级（0=退回学生）
}
