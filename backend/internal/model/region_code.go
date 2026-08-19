package model

// RegionCode 国家行政区划代码（12 位统计用区划码）。
// 身份证前 6 位对应 Code 的前 6 位（IDPrefix），用于解析学生户籍地。
type RegionCode struct {
	BaseModel
	Code       string `gorm:"size:12;uniqueIndex;not null" json:"code"`
	Name       string `gorm:"size:64;not null;index" json:"name"`
	Level      int    `gorm:"index;not null" json:"level"` // 1 省/直辖市/自治区 2 地市 3 区县
	Type       string `gorm:"size:32" json:"type"`
	ParentCode string `gorm:"size:12;index" json:"parent_code"`
	IDPrefix   string `gorm:"size:6;index" json:"id_prefix"`
	Sort       int    `gorm:"default:0" json:"sort"`
}
