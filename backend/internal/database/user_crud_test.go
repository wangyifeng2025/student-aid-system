package database

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"gorm.io/gorm"
)

// setupTestDB 加载配置并连接数据库。
// 若数据库不可用则 Skip，方便在无数据库环境下运行。
func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("加载配置失败: %v", err)
	}

	db, err := New(cfg)
	if err != nil {
		t.Skipf("无法连接数据库(driver=%s, host=%s:%d, db=%s)，跳过测试: %v\n"+
			"如需运行，请确保数据库已启动，并通过环境变量配置连接，例如:\n"+
			"  SAS_DATABASE_HOST=127.0.0.1 SAS_DATABASE_PORT=5432 SAS_DATABASE_USER=postgres \\\n"+
			"  SAS_DATABASE_PASSWORD=yourpass SAS_DATABASE_NAME=student_aid go test ./internal/database/...",
			cfg.Database.Driver, cfg.Database.Host, cfg.Database.Port, cfg.Database.Name, err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("获取底层连接失败: %v", err)
	}
	if err := sqlDB.Ping(); err != nil {
		t.Skipf("数据库 Ping 失败，跳过测试: %v", err)
	}

	return db
}

// setupUserTable 确保 users 表已迁移。
func setupUserTable(t *testing.T, db *gorm.DB) {
	t.Helper()
	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatalf("迁移 User 表失败: %v", err)
	}
}

// uniqueUsername 生成唯一测试用户名，避免并行/重复运行冲突。
func uniqueUsername() string {
	return fmt.Sprintf("test_user_%d", time.Now().UnixNano())
}

// seedTestUser 插入一条测试用户，并在测试结束时硬删除清理。
func seedTestUser(t *testing.T, db *gorm.DB) *model.User {
	t.Helper()

	username := uniqueUsername()
	user := &model.User{
		Username:     username,
		PasswordHash: "hashed_password",
		RealName:     "测试用户",
		Role:         model.RoleStudent,
		Phone:        "13800000000",
		Status:       1,
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("预置测试用户失败: %v", err)
	}

	t.Cleanup(func() {
		db.Unscoped().Where("username = ?", username).Delete(&model.User{})
	})

	return user
}

// TestDatabaseConnection 验证能否连接数据库。
func TestDatabaseConnection(t *testing.T) {
	db := setupTestDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("获取底层连接失败: %v", err)
	}
	if err := sqlDB.Ping(); err != nil {
		t.Fatalf("数据库连接不可用: %v", err)
	}
	t.Log("数据库连接成功")
}

// TestUserCreate 测试创建用户。
func TestUserCreate(t *testing.T) {
	db := setupTestDB(t)
	setupUserTable(t, db)

	username := uniqueUsername()
	user := &model.User{
		Username:     username,
		PasswordHash: "hashed_password",
		RealName:     "测试用户",
		Role:         model.RoleStudent,
		Phone:        "13800000000",
		Status:       1,
	}
	t.Cleanup(func() {
		db.Unscoped().Where("username = ?", username).Delete(&model.User{})
	})

	if err := db.Create(user).Error; err != nil {
		t.Fatalf("创建用户失败: %v", err)
	}
	if user.ID == 0 {
		t.Fatal("创建用户后 ID 应为非零")
	}

	var count int64
	if err := db.Model(&model.User{}).Where("username = ?", username).Count(&count).Error; err != nil {
		t.Fatalf("统计用户失败: %v", err)
	}
	if count != 1 {
		t.Errorf("期望存在 1 条记录, 实际 %d", count)
	}
	t.Logf("创建用户成功, ID=%d", user.ID)
}

// TestUserRead 测试按 ID 查询用户。
func TestUserRead(t *testing.T) {
	db := setupTestDB(t)
	setupUserTable(t, db)

	user := seedTestUser(t, db)

	var got model.User
	if err := db.First(&got, user.ID).Error; err != nil {
		t.Fatalf("查询用户失败: %v", err)
	}
	if got.Username != user.Username {
		t.Errorf("用户名不匹配: 期望 %q, 实际 %q", user.Username, got.Username)
	}
	if got.RealName != "测试用户" {
		t.Errorf("姓名不匹配: 期望 %q, 实际 %q", "测试用户", got.RealName)
	}
	if got.Role != model.RoleStudent {
		t.Errorf("角色不匹配: 期望 %q, 实际 %q", model.RoleStudent, got.Role)
	}
	if got.Phone != "13800000000" {
		t.Errorf("手机号不匹配: 期望 %q, 实际 %q", "13800000000", got.Phone)
	}
	if got.Status != 1 {
		t.Errorf("状态不匹配: 期望 1, 实际 %d", got.Status)
	}
}

// TestUserUpdate 测试更新用户字段。
func TestUserUpdate(t *testing.T) {
	db := setupTestDB(t)
	setupUserTable(t, db)

	user := seedTestUser(t, db)

	if err := db.Model(user).Updates(map[string]any{
		"real_name": "更新后的姓名",
		"status":    0,
		"phone":     "13900000000",
	}).Error; err != nil {
		t.Fatalf("更新用户失败: %v", err)
	}

	var updated model.User
	if err := db.First(&updated, user.ID).Error; err != nil {
		t.Fatalf("查询更新后的用户失败: %v", err)
	}
	if updated.RealName != "更新后的姓名" {
		t.Errorf("更新后姓名不匹配: 期望 %q, 实际 %q", "更新后的姓名", updated.RealName)
	}
	if updated.Status != 0 {
		t.Errorf("更新后状态不匹配: 期望 0, 实际 %d", updated.Status)
	}
	if updated.Phone != "13900000000" {
		t.Errorf("更新后手机号不匹配: 期望 %q, 实际 %q", "13900000000", updated.Phone)
	}
}

// TestUserDelete 测试软删除（gorm.DeletedAt）。
func TestUserDelete(t *testing.T) {
	db := setupTestDB(t)
	setupUserTable(t, db)

	user := seedTestUser(t, db)

	if err := db.Delete(&model.User{}, user.ID).Error; err != nil {
		t.Fatalf("删除用户失败: %v", err)
	}

	// 普通查询应查不到
	var afterDelete model.User
	err := db.First(&afterDelete, user.ID).Error
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Errorf("软删除后普通查询应返回 ErrRecordNotFound, 实际: %v", err)
	}

	// Unscoped 仍能查到，且 DeletedAt 已被设置
	var softDeleted model.User
	if err := db.Unscoped().First(&softDeleted, user.ID).Error; err != nil {
		t.Fatalf("Unscoped 查询软删除记录失败: %v", err)
	}
	if !softDeleted.DeletedAt.Valid {
		t.Error("软删除后 DeletedAt 应被设置")
	}
}
