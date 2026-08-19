package handler

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/database"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/middleware"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/pkg/jwt"
	"gorm.io/gorm"
)

func setupDashboardRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
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
	secured.GET("/dashboard", h.DashboardOverview)
	return r, db
}

func TestDashboardOverviewByRoleScope(t *testing.T) {
	r, db := setupDashboardRouter(t)

	cases := []struct {
		role  model.Role
		scope string
		label string
	}{
		{model.RoleStudent, "self", "仅本人"},
		{model.RoleClassAdvisor, "class", "本班级"},
		{model.RoleDepartment, "department", "本教学系"},
		{model.RoleAidCenter, "school", "全校"},
		{model.RoleAdmin, "school", "全校"},
	}
	for _, tt := range cases {
		t.Run(string(tt.role), func(t *testing.T) {
			user := seedUser(t, db, "pass123", tt.role)
			token := loginToken(t, r, user.Username, "pass123")
			w := doJSON(t, r, http.MethodGet, "/api/v1/dashboard?year=2026", token, nil)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d, body %s", w.Code, w.Body.String())
			}
			var resp struct {
				Data dto.DashboardOverview `json:"data"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if resp.Data.DataScope != tt.scope {
				t.Fatalf("data_scope = %s, want %s", resp.Data.DataScope, tt.scope)
			}
			if resp.Data.ScopeLabel != tt.label {
				t.Fatalf("scope_label = %s, want %s", resp.Data.ScopeLabel, tt.label)
			}
			if resp.Data.Year != 2026 {
				t.Fatalf("year = %d", resp.Data.Year)
			}
			if len(resp.Data.KPIs) != 4 {
				t.Fatalf("kpis len = %d", len(resp.Data.KPIs))
			}
		})
	}
}

func TestDashboardOverviewUnauthorized(t *testing.T) {
	r, _ := setupDashboardRouter(t)
	w := doJSON(t, r, http.MethodGet, "/api/v1/dashboard", "", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expect 401, got %d, body %s", w.Code, w.Body.String())
	}
}
