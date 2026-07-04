package main

import (
	"log"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"gorm.io/gorm"
)

// dictSeed 单个字典项的种子定义（sort 按声明顺序自动赋值）。
type dictSeed struct {
	Code  string
	Label string
}

// defaultDicts 各业务字典的默认项。codes 与 model/enums.go 中的枚举对齐，
// 便于前后端用统一的 code 交互；admin 可在系统管理中增删改。
var defaultDicts = map[string][]dictSeed{
	// 户口类型（与 model.HouseholdType 对齐）
	"household_type": {
		{"urban", "城镇"},
		{"rural", "农村"},
	},
	// 困难等级（与 model.DifficultyLevel 对齐）
	"difficulty_level": {
		{"special", "特别困难"},
		{"hard", "比较困难"},
		{"general", "一般困难"},
	},
	// 健康状况（认定表家庭成员字段）
	"health_status": {
		{"good", "良好"},
		{"poor", "较差"},
		{"disabled", "残疾"},
	},
	// 职业（认定表家庭成员字段）
	"occupation": {
		{"worker", "务工"},
		{"farmer", "务农"},
		{"none", "无"},
		{"student", "读书"},
		{"other", "其他"},
	},
	// 与学生关系（强调关系而非称呼）
	"relation": {
		{"father", "父亲"},
		{"mother", "母亲"},
		{"elder_brother", "哥哥"},
		{"younger_brother", "弟弟"},
		{"elder_sister", "姐姐"},
		{"younger_sister", "妹妹"},
		{"grandfather", "祖父"},
		{"grandmother", "祖母"},
		{"other", "其他"},
	},
	// 收入来源
	"income_source": {
		{"wage", "工资性收入"},
		{"farming", "务农收入"},
		{"business", "经营性收入"},
		{"subsidy", "补助/低保"},
		{"other", "其他"},
	},
	// 政治面貌
	"political_status": {
		{"masses", "群众"},
		{"league_member", "共青团员"},
		{"party_member", "中共党员"},
		{"probationary_party_member", "中共预备党员"},
		{"other", "其他"},
	},
	// 民族（默认提供常见若干项，其余可按需补充）
	"nation": {
		{"han", "汉族"},
		{"zhuang", "壮族"},
		{"hui", "回族"},
		{"man", "满族"},
		{"uygur", "维吾尔族"},
		{"miao", "苗族"},
		{"yi", "彝族"},
		{"tujia", "土家族"},
		{"zang", "藏族"},
		{"mongol", "蒙古族"},
		{"buyi", "布依族"},
		{"dong", "侗族"},
		{"other", "其他"},
	},
	// 特殊群体类型（与 model.SpecialGroupType 对齐，九大类 + 其他重点群体）
	"special_group_type": {
		{"poverty", "脱贫家庭学生"},
		{"poverty_unstable", "脱贫不稳定家庭学生"},
		{"marginal", "边缘易致贫家庭学生"},
		{"sudden_difficulty", "突发严重困难家庭学生"},
		{"low_income", "低保家庭学生"},
		{"low_income_margin", "低保边缘家庭学生"},
		{"extreme_poverty", "特困救助供养学生"},
		{"rigid_expenditure", "刚性支出困难家庭学生"},
		{"other_low_income", "其他低收入学生"},
		{"orphan", "孤儿"},
		{"no_guardian", "事实无人抚养儿童"},
		{"disabled_student", "残疾学生"},
		{"disabled_parent", "残疾人子女"},
		{"martyr_child", "烈士子女"},
	},
}

// seedDicts 幂等地写入默认字典项：仅插入 (type, code) 不存在的项，不覆盖已有数据。
func seedDicts(db *gorm.DB) error {
	var created int
	for dictType, entries := range defaultDicts {
		for i, e := range entries {
			var count int64
			if err := db.Model(&model.Dict{}).
				Where("type = ? AND code = ?", dictType, e.Code).
				Count(&count).Error; err != nil {
				return err
			}
			if count > 0 {
				continue
			}
			item := &model.Dict{Type: dictType, Code: e.Code, Label: e.Label, Sort: i}
			if err := db.Create(item).Error; err != nil {
				return err
			}
			created++
		}
	}
	log.Printf("字典种子完成：新增 %d 项", created)
	return nil
}
