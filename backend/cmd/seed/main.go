package main

import (
	"log"

	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/database"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/pkg/password"
	"gorm.io/gorm"
)

// 初始化开发/演示数据（幂等，可重复执行）：
// 字典、行政区划、admin/admin123、测试学生 2024010101/student123、
// 演示组织机构、评审账号 advisor01/dept01/aidcenter01（见 README 测试账号表）。
func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}
	if err := database.AutoMigrate(db); err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}

	if err := seedDicts(db); err != nil {
		log.Fatalf("初始化字典失败: %v", err)
	}
	if err := seedRegionCodes(db); err != nil {
		log.Fatalf("初始化行政区划失败: %v", err)
	}

	if err := seedAdmin(db); err != nil {
		log.Fatalf("初始化管理员失败: %v", err)
	}
	if err := seedDemoStudent(db); err != nil {
		log.Fatalf("初始化测试学生失败: %v", err)
	}
	org, err := seedDemoOrg(db)
	if err != nil {
		log.Fatalf("初始化演示组织机构失败: %v", err)
	}
	if err := linkStudentToDemoOrg(db, "2024010101", org); err != nil {
		log.Fatalf("关联测试学生与班级失败: %v", err)
	}
	if err := seedDemoReviewers(db, org); err != nil {
		log.Fatalf("初始化评审测试账号失败: %v", err)
	}
}

// seedAdmin 幂等创建默认管理员（admin / admin123）。
func seedAdmin(db *gorm.DB) error {
	const username = "admin"
	var count int64
	if err := db.Model(&model.User{}).Where("username = ?", username).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		log.Printf("管理员 %s 已存在，跳过创建", username)
		return nil
	}
	hash, err := password.Hash("admin123")
	if err != nil {
		return err
	}
	admin := &model.User{
		Username:     username,
		PasswordHash: hash,
		RealName:     "系统管理员",
		Role:         model.RoleAdmin,
		Status:       1,
	}
	if err := db.Create(admin).Error; err != nil {
		return err
	}
	log.Printf("已创建默认管理员: username=%s password=admin123（请尽快修改密码）", username)
	return nil
}

// seedDemoStudent 幂等创建一个可登录的测试学生账号及其学生档案，
// 便于在缺少用户管理界面时验证“困难认定填报”流程。
// 默认: username=2024010101, password=student123
func seedDemoStudent(db *gorm.DB) error {
	const studentNo = "2024010101"
	var user model.User
	err := db.Where("username = ?", studentNo).First(&user).Error
	if err == gorm.ErrRecordNotFound {
		hash, hErr := password.Hash("student123")
		if hErr != nil {
			return hErr
		}
		user = model.User{
			Username:     studentNo,
			PasswordHash: hash,
			RealName:     "测试学生",
			Role:         model.RoleStudent,
			Phone:        "13800000000",
			Status:       1,
		}
		if cErr := db.Create(&user).Error; cErr != nil {
			return cErr
		}
		log.Printf("已创建测试学生账号: username=%s password=student123", studentNo)
	} else if err != nil {
		return err
	} else {
		log.Printf("测试学生账号 %s 已存在，跳过创建", studentNo)
	}

	var stuCount int64
	if err := db.Model(&model.Student{}).
		Where("student_no = ?", studentNo).Count(&stuCount).Error; err != nil {
		return err
	}
	if stuCount > 0 {
		return nil
	}
	uid := user.ID
	stu := &model.Student{
		UserID:    &uid,
		StudentNo: studentNo,
		Name:      "测试学生",
		Gender:    "男",
		IDCard:    "110101200601010014",
		Nation:    "han",
		Phone:     "13800000000",
	}
	if err := db.Create(stu).Error; err != nil {
		return err
	}
	log.Printf("已创建测试学生档案: student_no=%s（已关联登录账号）", studentNo)
	return nil
}
