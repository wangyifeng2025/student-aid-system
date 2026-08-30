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

func setupAdvisorRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
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
	if err := database.AutoMigrate(db); err != nil {
		t.Fatalf("迁移表失败: %v", err)
	}

	jwtMgr := jwt.NewManager(cfg.JWT.Secret, cfg.JWT.Issuer, cfg.JWT.ExpireHours, cfg.JWT.RefreshExpireHours)
	h := New(db, cfg, jwtMgr)
	r := gin.New()
	api := r.Group("/api/v1")
	api.POST("/auth/login", h.Login)
	secured := api.Group("")
	secured.Use(middleware.JWTAuth(jwtMgr), middleware.LoadCurrentUser(db))
	secured.GET("/me", h.Me)
	adminOnly := secured.Group("")
	adminOnly.Use(middleware.RequireRoles(model.RoleAdmin))
	adminOnly.GET("/advisors", h.ListAdvisors)
	adminOnly.POST("/advisors", h.CreateAdvisor)
	adminOnly.GET("/advisors/:id", h.GetAdvisor)
	adminOnly.PUT("/advisors/:id", h.UpdateAdvisor)
	adminOnly.DELETE("/advisors/:id", h.DeleteAdvisor)
	return r, db
}

func TestAdvisorCRUDMultiClass(t *testing.T) {
	r, db := setupAdvisorRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")
	dept, _, class := seedStudentOrgRefs(t, db)

	suffix := fmt.Sprintf("%d", time.Now().UnixNano()%100000)
	class2 := model.Class{DeptID: dept.ID, Name: "第二班" + suffix}
	if err := db.Create(&class2).Error; err != nil {
		t.Fatalf("create class2: %v", err)
	}
	t.Cleanup(func() {
		db.Unscoped().Where("id = ?", class2.ID).Delete(&model.Class{})
	})

	student := seedUser(t, db, "pass123", model.RoleStudent)
	studentToken := loginToken(t, r, student.Username, "pass123")
	w := doJSON(t, r, http.MethodGet, "/api/v1/advisors", studentToken, nil)
	if w.Code != http.StatusForbidden {
		t.Fatalf("student list expect 403, got %d", w.Code)
	}

	phone := fmt.Sprintf("139%08d", time.Now().UnixNano()%100000000)
	staffNo := fmt.Sprintf("T%s", suffix)
	w = doJSON(t, r, http.MethodPost, "/api/v1/advisors", token, dto.AdvisorRequest{
		DeptID:   dept.ID,
		StaffNo:  staffNo,
		Name:     "多班班主任",
		Phone:    phone,
		ClassIDs: []uint{class.ID, class2.ID},
	})
	if w.Code != http.StatusOK {
		t.Fatalf("create advisor %d, body %s", w.Code, w.Body.String())
	}
	var created struct {
		Data dto.AdvisorResponse `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if created.Data.ID == 0 || len(created.Data.Classes) != 2 {
		t.Fatalf("want 2 classes, got %+v", created.Data)
	}
	if created.Data.StaffNo != staffNo {
		t.Fatalf("staff_no want %s, got %s", staffNo, created.Data.StaffNo)
	}
	if created.Data.Username != staffNo {
		t.Fatalf("username want staff_no %s, got %s", staffNo, created.Data.Username)
	}
	if created.Data.UserID == nil || created.Data.InitialPassword == "" {
		t.Fatalf("want login user and initial password, got %+v", created.Data)
	}
	advToken := loginToken(t, r, staffNo, created.Data.InitialPassword)
	w = doJSON(t, r, http.MethodGet, "/api/v1/me", advToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("advisor me %d, body %s", w.Code, w.Body.String())
	}
	var me struct {
		Data dto.MeResponse `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &me); err != nil {
		t.Fatalf("decode me: %v", err)
	}
	if len(me.Data.UserBrief.ClassIDs) != 2 {
		t.Fatalf("me class_ids want 2, got %+v", me.Data.UserBrief.ClassIDs)
	}

	t.Cleanup(func() {
		db.Unscoped().Where("id = ?", created.Data.ID).Delete(&model.Advisor{})
		db.Where("advisor_id = ?", created.Data.ID).Delete(&model.AdvisorClass{})
		if created.Data.UserID != nil {
			db.Unscoped().Where("id = ?", *created.Data.UserID).Delete(&model.User{})
		}
	})

	w = doJSON(t, r, http.MethodPut, fmt.Sprintf("/api/v1/advisors/%d", created.Data.ID), token, dto.AdvisorRequest{
		DeptID:   dept.ID,
		StaffNo:  staffNo,
		Name:     "多班班主任",
		Phone:    phone,
		ClassIDs: []uint{class2.ID},
	})
	if w.Code != http.StatusOK {
		t.Fatalf("update advisor %d, body %s", w.Code, w.Body.String())
	}
	var updated struct {
		Data dto.AdvisorResponse `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &updated)
	if len(updated.Data.Classes) != 1 || updated.Data.Classes[0].ID != class2.ID {
		t.Fatalf("update classes want only class2, got %+v", updated.Data.Classes)
	}

	w = doJSON(t, r, http.MethodDelete, fmt.Sprintf("/api/v1/advisors/%d", created.Data.ID), token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete advisor %d, body %s", w.Code, w.Body.String())
	}
	if created.Data.UserID != nil {
		var u model.User
		if err := db.First(&u, *created.Data.UserID).Error; err != gorm.ErrRecordNotFound {
			t.Fatalf("linked user should be deleted, err=%v id=%d", err, *created.Data.UserID)
		}
	}
}
