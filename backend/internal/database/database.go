package database

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
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
	// 先补教工号再加唯一约束，避免存量空值导致 AutoMigrate 失败。
	if err := ensureAdvisorStaffNo(db); err != nil {
		return err
	}
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
	if err := backfillAdvisorsFromUsers(db); err != nil {
		return err
	}
	if err := dropUsersClassID(db); err != nil {
		return err
	}
	if err := renameDifficultyHardLabel(db); err != nil {
		return err
	}
	log.Println("数据库迁移完成")
	return nil
}

// renameDifficultyHardLabel 将困难档次 hard 的展示名从「比较困难」改为「困难」（幂等）。
func renameDifficultyHardLabel(db *gorm.DB) error {
	if !db.Migrator().HasTable(&model.Dict{}) {
		return nil
	}
	return db.Model(&model.Dict{}).
		Where("type = ? AND code = ? AND label = ?", "difficulty_level", "hard", "比较困难").
		Update("label", "困难").Error
}

// ensureAdvisorStaffNo 为已有 advisors 表补教工号列及存量值（幂等）。
func ensureAdvisorStaffNo(db *gorm.DB) error {
	if !db.Migrator().HasTable(&model.Advisor{}) {
		return nil
	}
	if !db.Migrator().HasColumn(&model.Advisor{}, "staff_no") {
		if err := db.Exec("ALTER TABLE advisors ADD COLUMN staff_no varchar(64)").Error; err != nil {
			return err
		}
	}
	return backfillAdvisorStaffNos(db)
}

func backfillAdvisorStaffNos(db *gorm.DB) error {
	var advisors []model.Advisor
	if err := db.Unscoped().Find(&advisors).Error; err != nil {
		return err
	}
	for i := range advisors {
		a := &advisors[i]
		if strings.TrimSpace(a.StaffNo) != "" {
			continue
		}
		staffNo := fmt.Sprintf("ADV%d", a.ID)
		if a.UserID != nil && *a.UserID > 0 {
			var u model.User
			if err := db.Select("username").First(&u, *a.UserID).Error; err == nil {
				if n := strings.TrimSpace(u.Username); n != "" {
					staffNo = n
				}
			}
		}
		var count int64
		if err := db.Model(&model.Advisor{}).Where("staff_no = ? AND id <> ?", staffNo, a.ID).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			staffNo = fmt.Sprintf("ADV%d", a.ID)
		}
		if err := db.Model(a).Update("staff_no", staffNo).Error; err != nil {
			return err
		}
	}
	return nil
}

// backfillAdvisorsFromUsers 把已有 classadvisor 账号写入班主任名册（幂等）。
func backfillAdvisorsFromUsers(db *gorm.DB) error {
	var users []model.User
	if err := db.Where("role = ?", model.RoleClassAdvisor).Find(&users).Error; err != nil {
		return err
	}
	repo := repository.NewAdvisorRepository(db)
	for i := range users {
		u := users[i]
		if _, err := repo.FindByUserID(u.ID); err == nil {
			continue
		} else if !repository.IsNotFound(err) {
			return err
		}
		if u.DeptID == nil || *u.DeptID == 0 {
			continue
		}
		name := strings.TrimSpace(u.RealName)
		if name == "" {
			name = u.Username
		}
		staffNo := strings.TrimSpace(u.Username)
		if staffNo == "" {
			staffNo = fmt.Sprintf("U%d", u.ID)
		}
		var occupied model.Advisor
		if err := db.Unscoped().Where("staff_no = ?", staffNo).First(&occupied).Error; err == nil {
			if occupied.DeletedAt.Valid {
				continue
			}
			if occupied.UserID == nil {
				uid := u.ID
				occupied.UserID = &uid
				if err := repo.Save(&occupied); err != nil {
					return err
				}
			}
			continue
		} else if !repository.IsNotFound(err) {
			return err
		}
		uid := u.ID
		a := &model.Advisor{DeptID: *u.DeptID, StaffNo: staffNo, Name: name, Phone: u.Phone, UserID: &uid}
		if err := repo.Create(a); err != nil {
			return err
		}
		if cid := legacyUserClassID(db, u.ID); cid != nil && *cid > 0 {
			if err := repo.ReplaceClasses(a.ID, []uint{*cid}); err != nil {
				return err
			}
		}
	}
	return nil
}

// userClassIDCol 仅用于探测/删除历史 users.class_id（已从 User 模型移除）。
type userClassIDCol struct {
	ClassID *uint `gorm:"column:class_id"`
}

func (userClassIDCol) TableName() string { return "users" }

func legacyUserClassID(db *gorm.DB, userID uint) *uint {
	if !db.Migrator().HasColumn(&userClassIDCol{}, "class_id") {
		return nil
	}
	var row userClassIDCol
	if err := db.Table("users").Select("class_id").Where("id = ?", userID).Take(&row).Error; err != nil {
		return nil
	}
	return row.ClassID
}

func dropUsersClassID(db *gorm.DB) error {
	if !db.Migrator().HasColumn(&userClassIDCol{}, "class_id") {
		return nil
	}
	return db.Migrator().DropColumn(&userClassIDCol{}, "class_id")
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
