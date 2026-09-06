package model

// Role 用户角色
type Role string

const (
	RoleStudent      Role = "student"      // 学生
	RoleClassAdvisor Role = "classadvisor" // 班主任/辅导员（班级评审）
	RoleDepartment   Role = "department"   // 教学系经办人（系评审）
	RoleAidCenter    Role = "aidcenter"    // 资助中心（院级终审）
	RoleAdmin        Role = "admin"        // 系统管理员
)

// AllRoles 返回全部合法角色。
func AllRoles() []Role {
	return []Role{RoleStudent, RoleClassAdvisor, RoleDepartment, RoleAidCenter, RoleAdmin}
}

// IsValidRole 判断角色取值是否合法。
func IsValidRole(s string) bool {
	for _, r := range AllRoles() {
		if string(r) == s {
			return true
		}
	}
	return false
}

// ReviewLevel 评审级别（三级评审；LevelFinal 仅兼容历史数据）
type ReviewLevel int

const (
	LevelClass      ReviewLevel = 1 // 班级评审
	LevelDepartment ReviewLevel = 2 // 教学系评审
	LevelCollege    ReviewLevel = 3 // 院级评审（资助中心，终审）
	LevelFinal      ReviewLevel = 4 // 已废弃，仅兼容历史 pending_final 数据
)

// ApplicationStatus 认定申请状态
type ApplicationStatus string

const (
	StatusDraft          ApplicationStatus = "draft"           // 草稿
	StatusPendingClass   ApplicationStatus = "pending_class"   // 待班级评审
	StatusPendingDept    ApplicationStatus = "pending_dept"    // 待教学系评审
	StatusPendingCollege ApplicationStatus = "pending_college" // 待院级评审
	StatusPendingFinal   ApplicationStatus = "pending_final"   // 已废弃，仅兼容历史数据
	StatusApproved       ApplicationStatus = "approved"        // 认定通过
	StatusRejected       ApplicationStatus = "rejected"        // 已退回
)

// ReviewAction 评审动作
type ReviewAction string

const (
	ActionPass   ReviewAction = "pass"   // 通过
	ActionReject ReviewAction = "reject" // 退回
)

// DifficultyLevel 困难等级
type DifficultyLevel string

const (
	DifficultySpecial DifficultyLevel = "special" // 特别困难
	DifficultyHard    DifficultyLevel = "hard"    // 困难
	DifficultyGeneral DifficultyLevel = "general" // 一般困难
)

// IsValidDifficultyLevel 判断是否为合法困难等级。
func IsValidDifficultyLevel(s string) bool {
	switch DifficultyLevel(s) {
	case DifficultySpecial, DifficultyHard, DifficultyGeneral:
		return true
	default:
		return false
	}
}

// HouseholdType 户口类型
type HouseholdType string

const (
	HouseholdUrban HouseholdType = "urban" // 城镇
	HouseholdRural HouseholdType = "rural" // 农村
)

// SpecialGroupType 特殊群体类型（九大类 + 其他）
type SpecialGroupType string

const (
	SGPoverty           SpecialGroupType = "poverty"            // 脱贫家庭学生
	SGPovertyUnstable   SpecialGroupType = "poverty_unstable"   // 脱贫不稳定家庭学生
	SGMarginal          SpecialGroupType = "marginal"           // 边缘易致贫家庭学生
	SGSuddenDifficulty  SpecialGroupType = "sudden_difficulty"  // 突发严重困难家庭学生
	SGLowIncome         SpecialGroupType = "low_income"         // 低保家庭学生
	SGLowIncomeMargin   SpecialGroupType = "low_income_margin"  // 低保边缘家庭学生
	SGExtremePoverty    SpecialGroupType = "extreme_poverty"    // 特困救助供养学生
	SGRigidExpenditure  SpecialGroupType = "rigid_expenditure"  // 刚性支出困难家庭学生
	SGOtherLowIncome    SpecialGroupType = "other_low_income"   // 其他低收入学生
	SGOrphan            SpecialGroupType = "orphan"             // 孤儿
	SGNoGuardian        SpecialGroupType = "no_guardian"        // 事实无人抚养儿童
	SGDisabledStudent   SpecialGroupType = "disabled_student"   // 残疾学生
	SGDisabledParent    SpecialGroupType = "disabled_parent"    // 残疾人子女
	SGMartyrChild       SpecialGroupType = "martyr_child"       // 烈士子女
	SGPovertyRelocation SpecialGroupType = "poverty_relocation" // 是否异地扶贫搬迁
)

// AllSpecialGroupTypes 返回全部合法的特殊群体类型（与 special_group_type 字典对齐）。
func AllSpecialGroupTypes() []SpecialGroupType {
	return []SpecialGroupType{
		SGPoverty, SGPovertyUnstable, SGMarginal, SGSuddenDifficulty,
		SGLowIncome, SGLowIncomeMargin, SGExtremePoverty, SGRigidExpenditure,
		SGOtherLowIncome, SGOrphan, SGNoGuardian, SGDisabledStudent,
		SGDisabledParent, SGMartyrChild, SGPovertyRelocation,
	}
}

// IsValidSpecialGroupType 判断是否为合法的特殊群体类型。
func IsValidSpecialGroupType(s string) bool {
	for _, t := range AllSpecialGroupTypes() {
		if string(t) == s {
			return true
		}
	}
	return false
}

// GrantType 资助/奖助类型
type GrantType string

const (
	GrantNationalAid   GrantType = "national_aid"   // 国家助学金
	GrantInspirational GrantType = "inspirational"  // 励志奖学金
	GrantTuitionRefund GrantType = "tuition_refund" // 学费补偿
	GrantVeteran       GrantType = "veteran"        // 退役士兵资助
)

// GrantStatus 资助申请状态（三级评审，与认定流程对齐）
type GrantStatus string

const (
	GrantStatusDraft          GrantStatus = "draft"
	GrantStatusPendingClass   GrantStatus = "pending_class"
	GrantStatusPendingDept    GrantStatus = "pending_dept"
	GrantStatusPendingCollege GrantStatus = "pending_college"
	GrantStatusApproved       GrantStatus = "approved"
	GrantStatusRejected       GrantStatus = "rejected"
)
