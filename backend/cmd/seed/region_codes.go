package main

import (
	"log"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/service"
	"gorm.io/gorm"
)

// seedRegionCodes 表为空时写入内置全国行政区划（幂等：已有数据则跳过）。
func seedRegionCodes(db *gorm.DB) error {
	var n int64
	if err := db.Model(&model.RegionCode{}).Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		log.Printf("行政区划已有 %d 条，跳过导入", n)
		return nil
	}
	res, err := service.NewRegionCodeService(db).ImportDefault()
	if err != nil {
		return err
	}
	log.Printf("行政区划种子完成：新增 %d 项，跳过 %d 项", res.Created, res.Skipped)
	return nil
}
