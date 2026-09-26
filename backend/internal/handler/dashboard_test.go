package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/xuri/excelize/v2"

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
	secured.GET("/dashboard/review-progress-export", h.ExportDashboardReviewProgress)
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

func TestDashboardReviewProgress(t *testing.T) {
	r, db := setupDashboardRouter(t)
	dept, _, class := seedStudentOrgRefs(t, db)
	year := int(time.Now().UnixNano()%100000) + 400000

	makeApp := func(name string, status model.ApplicationStatus) {
		t.Helper()
		user := seedUser(t, db, "pass123", model.RoleStudent)
		stu := seedScopedStudent(t, db, user.ID, class.ID, dept.ID)
		if err := db.Model(stu).Update("name", name).Error; err != nil {
			t.Fatalf("update student: %v", err)
		}
		app := model.RecognitionApplication{
			StudentID: stu.ID,
			Year:      year,
			Status:    status,
		}
		if err := db.Create(&app).Error; err != nil {
			t.Fatalf("create app: %v", err)
		}
	}
	makeApp("待班级", model.StatusPendingClass)
	makeApp("待系", model.StatusPendingDept)
	makeApp("待院", model.StatusPendingCollege)
	makeApp("历史院级", model.StatusPendingFinal)
	makeApp("已通过", model.StatusApproved)
	makeApp("草稿", model.StatusDraft)

	advisor := seedReviewer(t, db, model.RoleClassAdvisor, class.ID, dept.ID)
	advisorToken := loginToken(t, r, advisor.Username, "pass123")
	w := doJSON(t, r, http.MethodGet, fmt.Sprintf("/api/v1/dashboard?year=%d", year), advisorToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("advisor status %d, body %s", w.Code, w.Body.String())
	}
	var advisorResp struct {
		Data dto.DashboardOverview `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &advisorResp); err != nil {
		t.Fatalf("unmarshal advisor: %v", err)
	}
	if len(advisorResp.Data.ReviewProgress) != 0 {
		t.Fatalf("class advisor should not get review progress, got %+v", advisorResp.Data.ReviewProgress)
	}

	center := seedReviewer(t, db, model.RoleAidCenter, 0, 0)
	token := loginToken(t, r, center.Username, "pass123")
	w = doJSON(t, r, http.MethodGet, fmt.Sprintf("/api/v1/dashboard?year=%d", year), token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("aidcenter status %d, body %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data dto.DashboardOverview `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	var got *dto.DashboardDeptProgress
	for i := range resp.Data.ReviewProgress {
		if resp.Data.ReviewProgress[i].DeptID == dept.ID {
			got = &resp.Data.ReviewProgress[i]
			break
		}
	}
	if got == nil {
		t.Fatalf("dept %d missing in %+v", dept.ID, resp.Data.ReviewProgress)
	}
	if got.DeptName != dept.Name || got.PendingClass != 1 || got.PendingDept != 1 || got.PendingCollege != 2 || got.Total != 4 {
		t.Fatalf("dept progress = %+v", got)
	}
	if len(got.Classes) != 1 || got.Classes[0].ClassID != class.ID || got.Classes[0].ClassName != class.Name || got.Classes[0].Total != 4 {
		t.Fatalf("class progress = %+v", got.Classes)
	}

	w = doJSON(t, r, http.MethodGet, fmt.Sprintf("/api/v1/dashboard/review-progress-export?year=%d", year), advisorToken, nil)
	if w.Code != http.StatusForbidden {
		t.Fatalf("advisor export expect 403, got %d body %s", w.Code, w.Body.String())
	}
	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/v1/dashboard/review-progress-export?year=%d", year), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("export status %d, body %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Header().Get("Content-Disposition"), url.PathEscape(fmt.Sprintf("%d学年各系认定待审.xlsx", year))) {
		t.Fatalf("filename missing, disposition %s", w.Header().Get("Content-Disposition"))
	}
	xf, err := excelize.OpenReader(bytes.NewReader(w.Body.Bytes()))
	if err != nil {
		t.Fatalf("open xlsx: %v", err)
	}
	defer xf.Close()
	rows, err := xf.GetRows("各系待审")
	if err != nil {
		t.Fatalf("sheet: %v", err)
	}
	var deptRow, classRow bool
	for _, row := range rows {
		if len(row) < 6 || row[0] != dept.Name {
			continue
		}
		if row[1] == "合计" && row[2] == "1" && row[3] == "1" && row[4] == "2" && row[5] == "4" {
			deptRow = true
		}
		if row[1] == class.Name && row[5] == "4" {
			classRow = true
		}
	}
	if !deptRow || !classRow {
		t.Fatalf("export rows = %#v", rows)
	}
}

func TestDashboardOverviewUnauthorized(t *testing.T) {
	r, _ := setupDashboardRouter(t)
	w := doJSON(t, r, http.MethodGet, "/api/v1/dashboard", "", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expect 401, got %d, body %s", w.Code, w.Body.String())
	}
}
