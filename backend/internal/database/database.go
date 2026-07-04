package database

import (
	"fmt"
	"log"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// New 根据配置创建 GORM 数据库连接。
func New(cfg *config.Config) (*gorm.DB, error) {
	gormCfg := &gorm.Config{
		Logger: logger.Default.LogMode(logModeFor(cfg.App.Env)),
	}

	var dialector gorm.Dialector
	switch cfg.Database.Driver {
	case "postgres", "":
		dialector = postgres.Open(postgresDSN(cfg.Database))
	case "mysql":
		dialector = mysql.Open(mysqlDSN(cfg.Database))
	default:
		return nil, fmt.Errorf("不支持的数据库驱动: %s", cfg.Database.Driver)
	}

	db, err := gorm.Open(dialector, gormCfg)
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(50)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return db, nil
}

// AutoMigrate 自动迁移所有模型。
func AutoMigrate(db *gorm.DB) error {
	log.Println("开始数据库自动迁移...")
	if err := db.AutoMigrate(model.AllModels()...); err != nil {
		return err
	}
	// 历史数据可能将未关联账号的 user_id 存为 0，与唯一索引冲突；统一置为 NULL。
	if err := db.Model(&model.Student{}).Where("user_id = ?", 0).Update("user_id", nil).Error; err != nil {
		return err
	}
	// 历史空身份证号无法参与唯一约束，迁移前以 id 左补零占位（后续请管理员补录真实号码）。
	if err := db.Exec(`UPDATE students SET id_card = LPAD(id::text, 18, '0') WHERE (id_card = '' OR id_card IS NULL) AND deleted_at IS NULL`).Error; err != nil {
		return err
	}
	log.Println("数据库迁移完成")
	return nil
}

func mysqlDSN(c config.DatabaseConfig) string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?%s",
		c.User, c.Password, c.Host, c.Port, c.Name, c.Params)
}

func postgresDSN(c config.DatabaseConfig) string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s %s",
		c.Host, c.Port, c.User, c.Password, c.Name, c.Params)
}

func logModeFor(env string) logger.LogLevel {
	if env == "prod" {
		return logger.Warn
	}
	return logger.Info
}
