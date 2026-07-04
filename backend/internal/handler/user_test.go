package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/database"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/middleware"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/pkg/jwt"
	"gorm.io/gorm"
)

func setupUserRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("加载配置失败: %v", err)
	}
	db, err := database.New(cfg)
	if err != nil {
		t.Skipf("无法连接数据库，跳过测试: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("获取底层连接失败: %v", err)
	}
	if err := sqlDB.Ping(); err != nil {
		t.Skipf("数据库 Ping 失败，跳过测试: %v", err)
	}
	if err := db.AutoMigrate(model.AllModels()...); err != nil {
		t.Fatalf("迁移表失败: %v", err)
	}

	jwtMgr := jwt.NewManager(cfg.JWT.Secret, cfg.JWT.Issuer, cfg.JWT.ExpireHours, cfg.JWT.RefreshExpireHours)
	h := New(db, cfg, jwtMgr)

	r := gin.New()
	api := r.Group("/api/v1")
	api.POST("/auth/login", h.Login)

	secured := api.Group("")
	secured.Use(middleware.JWTAuth(jwtMgr), middleware.LoadCurrentUser(db))
	adminOnly := secured.Group("")
	adminOnly.Use(middleware.RequireRoles(model.RoleAdmin))
	users := adminOnly.Group("/users")
	users.GET("", h.ListUsers)
	users.GET("/:id", h.GetUser)
	users.POST("", h.CreateUser)
	users.PUT("/:id", h.UpdateUser)
	users.DELETE("/:id", h.DeleteUser)
	users.POST("/:id/reset-password", h.ResetUserPassword)

	return r, db
}

// cleanupUser 在测试结束后物理删除指定用户名的用户。
func cleanupUser(t *testing.T, db *gorm.DB, username string) {
	t.Cleanup(func() {
		db.Unscoped().Where("username = ?", username).Delete(&model.User{})
	})
}

func TestUserManagementCRUD(t *testing.T) {
	r, db := setupUserRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	username := fmt.Sprintf("u_%d", time.Now().UnixNano())
	cleanupUser(t, db, username)

	// 创建
	w := doJSON(t, r, http.MethodPost, "/api/v1/users", token, dto.UserCreateRequest{
		Username: username,
		Password: "pass123",
		RealName: "新班主任",
		Role:     string(model.RoleClassAdvisor),
		Phone:    "13800002222",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("create user status %d, body %s", w.Code, w.Body.String())
	}
	var createResp struct {
		Data dto.UserResponse `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &createResp)
	id := createResp.Data.ID
	if id == 0 || createResp.Data.Status != 1 {
		t.Fatalf("unexpected create resp: %+v", createResp.Data)
	}

	// 用户名重复 → 409
	w = doJSON(t, r, http.MethodPost, "/api/v1/users", token, dto.UserCreateRequest{
		Username: username, Password: "pass123", RealName: "x", Role: string(model.RoleStudent),
	})
	if w.Code != http.StatusConflict {
		t.Fatalf("duplicate username expect 409, got %d", w.Code)
	}

	// 修改：改姓名 + 角色 + 禁用
	disabled := 0
	w = doJSON(t, r, http.MethodPut, fmt.Sprintf("/api/v1/users/%d", id), token, dto.UserUpdateRequest{
		RealName: "改名后", Role: string(model.RoleDepartment), Phone: "13800003333", Status: &disabled,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("update user status %d, body %s", w.Code, w.Body.String())
	}
	var updResp struct {
		Data dto.UserResponse `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &updResp)
	if updResp.Data.RealName != "改名后" || updResp.Data.Role != model.RoleDepartment || updResp.Data.Status != 0 {
		t.Fatalf("update not applied: %+v", updResp.Data)
	}

	// 被禁用后无法登录
	w = doJSON(t, r, http.MethodPost, "/api/v1/auth/login", "", dto.LoginRequest{Username: username, Password: "pass123"})
	if w.Code == http.StatusOK {
		t.Fatalf("disabled user should not login")
	}

	// 重新启用
	enabled := 1
	w = doJSON(t, r, http.MethodPut, fmt.Sprintf("/api/v1/users/%d", id), token, dto.UserUpdateRequest{
		RealName: "改名后", Role: string(model.RoleDepartment), Status: &enabled,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("re-enable status %d", w.Code)
	}

	// 重置密码后用新密码登录
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/users/%d/reset-password", id), token,
		dto.ResetPasswordRequest{NewPassword: "newpass1"})
	if w.Code != http.StatusOK {
		t.Fatalf("reset password status %d, body %s", w.Code, w.Body.String())
	}
	newToken := loginToken(t, r, username, "newpass1")
	if newToken == "" {
		t.Fatalf("login with new password failed")
	}

	// 列表包含该用户
	w = doJSON(t, r, http.MethodGet, "/api/v1/users?keyword="+username, token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list users status %d", w.Code)
	}
	var listResp struct {
		Data dto.PageResult[dto.UserResponse] `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &listResp)
	if listResp.Data.Total < 1 {
		t.Fatalf("list expect >=1, got %d", listResp.Data.Total)
	}

	// 删除
	w = doJSON(t, r, http.MethodDelete, fmt.Sprintf("/api/v1/users/%d", id), token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete user status %d, body %s", w.Code, w.Body.String())
	}
}

func TestUserCannotDeleteSelf(t *testing.T) {
	r, db := setupUserRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	w := doJSON(t, r, http.MethodDelete, fmt.Sprintf("/api/v1/users/%d", admin.ID), token, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("delete self expect 400, got %d, body %s", w.Code, w.Body.String())
	}
}

func TestUserManagementRequiresAdmin(t *testing.T) {
	r, db := setupUserRouter(t)
	advisor := seedUser(t, db, "pass123", model.RoleClassAdvisor)
	token := loginToken(t, r, advisor.Username, "pass123")

	w := doJSON(t, r, http.MethodGet, "/api/v1/users", token, nil)
	if w.Code != http.StatusForbidden {
		t.Fatalf("non-admin list users expect 403, got %d", w.Code)
	}
}
