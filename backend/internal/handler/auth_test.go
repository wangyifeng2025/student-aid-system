package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/database"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/middleware"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/pkg/jwt"
	"github.com/wangyifeng2025/student-aid-system/pkg/password"
	"gorm.io/gorm"
)

var testUserSeq int64

// setupAuthTestRouter 连接本地 PostgreSQL 并构建认证路由。
// 连接参数来自 config.Load()（默认值 + .env + SAS_ 前缀环境变量）；
// 若数据库不可用则 Skip，避免在无数据库环境下失败。
func setupAuthTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("加载配置失败: %v", err)
	}

	db, err := database.New(cfg)
	if err != nil {
		t.Skipf("无法连接数据库(driver=%s, host=%s:%d, db=%s)，跳过测试: %v",
			cfg.Database.Driver, cfg.Database.Host, cfg.Database.Port, cfg.Database.Name, err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("获取底层连接失败: %v", err)
	}
	if err := sqlDB.Ping(); err != nil {
		t.Skipf("数据库 Ping 失败，跳过测试: %v", err)
	}

	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatalf("迁移 User 表失败: %v", err)
	}

	jwtMgr := jwt.NewManager(cfg.JWT.Secret, cfg.JWT.Issuer, cfg.JWT.ExpireHours, cfg.JWT.RefreshExpireHours)
	h := New(db, cfg, jwtMgr)

	r := gin.New()
	api := r.Group("/api/v1")
	{
		auth := api.Group("/auth")
		auth.POST("/login", h.Login)
		auth.POST("/refresh", h.Refresh)
		auth.POST("/recover-password", h.RecoverPassword)

		secured := api.Group("")
		secured.Use(middleware.JWTAuth(jwtMgr), middleware.LoadCurrentUser(db))
		{
			secured.GET("/me", h.Me)
			secured.PUT("/auth/password", h.ChangePassword)
		}
	}
	return r, db
}

// seedUser 插入一条唯一的测试用户，并在测试结束时硬删除清理。
func seedUser(t *testing.T, db *gorm.DB, plainPassword string, role model.Role) *model.User {
	t.Helper()
	hash, err := password.Hash(plainPassword)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	seq := atomic.AddInt64(&testUserSeq, 1)
	username := fmt.Sprintf("test_auth_%d_%d", time.Now().UnixNano(), seq)
	phone := fmt.Sprintf("139%08d", seq%100000000)

	user := &model.User{
		Username:     username,
		PasswordHash: hash,
		RealName:     "测试",
		Role:         role,
		Phone:        phone,
		Status:       1,
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	t.Cleanup(func() {
		db.Unscoped().Where("username = ?", username).Delete(&model.User{})
	})
	return user
}

func TestAuthLoginAndMe(t *testing.T) {
	r, db := setupAuthTestRouter(t)
	user := seedUser(t, db, "pass123", model.RoleStudent)

	body, _ := json.Marshal(dto.LoginRequest{Username: user.Username, Password: "pass123"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("login status %d, body %s", w.Code, w.Body.String())
	}

	var loginResp struct {
		Code int               `json:"code"`
		Data dto.TokenResponse `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &loginResp); err != nil {
		t.Fatalf("decode login: %v", err)
	}
	if loginResp.Data.AccessToken == "" || loginResp.Data.RefreshToken == "" {
		t.Fatal("expected token pair")
	}

	meReq := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+loginResp.Data.AccessToken)
	meW := httptest.NewRecorder()
	r.ServeHTTP(meW, meReq)
	if meW.Code != http.StatusOK {
		t.Fatalf("me status %d, body %s", meW.Code, meW.Body.String())
	}
}

func TestAuthRefresh(t *testing.T) {
	r, db := setupAuthTestRouter(t)
	user := seedUser(t, db, "pass123", model.RoleStudent)

	loginBody, _ := json.Marshal(dto.LoginRequest{Username: user.Username, Password: "pass123"})
	loginReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginW := httptest.NewRecorder()
	r.ServeHTTP(loginW, loginReq)

	var loginResp struct {
		Data dto.TokenResponse `json:"data"`
	}
	json.Unmarshal(loginW.Body.Bytes(), &loginResp)

	refreshBody, _ := json.Marshal(dto.RefreshRequest{RefreshToken: loginResp.Data.RefreshToken})
	refreshReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", bytes.NewReader(refreshBody))
	refreshReq.Header.Set("Content-Type", "application/json")
	refreshW := httptest.NewRecorder()
	r.ServeHTTP(refreshW, refreshReq)

	if refreshW.Code != http.StatusOK {
		t.Fatalf("refresh status %d, body %s", refreshW.Code, refreshW.Body.String())
	}
}

func TestAuthChangePassword(t *testing.T) {
	r, db := setupAuthTestRouter(t)
	user := seedUser(t, db, "pass123", model.RoleStudent)

	loginBody, _ := json.Marshal(dto.LoginRequest{Username: user.Username, Password: "pass123"})
	loginReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginW := httptest.NewRecorder()
	r.ServeHTTP(loginW, loginReq)

	var loginResp struct {
		Data dto.TokenResponse `json:"data"`
	}
	json.Unmarshal(loginW.Body.Bytes(), &loginResp)

	changeBody, _ := json.Marshal(dto.ChangePasswordRequest{
		OldPassword: "pass123",
		NewPassword: "newpass1",
	})
	changeReq := httptest.NewRequest(http.MethodPut, "/api/v1/auth/password", bytes.NewReader(changeBody))
	changeReq.Header.Set("Content-Type", "application/json")
	changeReq.Header.Set("Authorization", "Bearer "+loginResp.Data.AccessToken)
	changeW := httptest.NewRecorder()
	r.ServeHTTP(changeW, changeReq)

	if changeW.Code != http.StatusOK {
		t.Fatalf("change password status %d, body %s", changeW.Code, changeW.Body.String())
	}
}

func TestAuthRecoverPassword(t *testing.T) {
	r, db := setupAuthTestRouter(t)
	user := seedUser(t, db, "pass123", model.RoleStudent)

	recoverBody, _ := json.Marshal(dto.RecoverPasswordRequest{
		Username:    user.Username,
		Phone:       user.Phone,
		NewPassword: "recover1",
	})
	recoverReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/recover-password", bytes.NewReader(recoverBody))
	recoverReq.Header.Set("Content-Type", "application/json")
	recoverW := httptest.NewRecorder()
	r.ServeHTTP(recoverW, recoverReq)

	if recoverW.Code != http.StatusOK {
		t.Fatalf("recover status %d, body %s", recoverW.Code, recoverW.Body.String())
	}
}
