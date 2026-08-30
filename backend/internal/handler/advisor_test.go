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
	adminOnly.POST("/import/advisors", h.ImportAdvisors)
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
	if err := db.Unscoped().First(&model.Advisor{}, created.Data.ID).Error; err != gorm.ErrRecordNotFound {
		t.Fatalf("advisor should be hard-deleted, err=%v", err)
	}
	if created.Data.UserID != nil {
		var u model.User
		if err := db.Unscoped().First(&u, *created.Data.UserID).Error; err != gorm.ErrRecordNotFound {
			t.Fatalf("linked user should be hard-deleted, err=%v id=%d", err, *created.Data.UserID)
		}
	}
}

func TestAdvisorDeleteBlockedByReviews(t *testing.T) {
	r, db := setupAdvisorRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")
	dept, _, class := seedStudentOrgRefs(t, db)

	suffix := fmt.Sprintf("%d", time.Now().UnixNano()%100000)
	staffNo := fmt.Sprintf("R%s", suffix)
	phone := fmt.Sprintf("138%08d", time.Now().UnixNano()%100000000)
	w := doJSON(t, r, http.MethodPost, "/api/v1/advisors", token, dto.AdvisorRequest{
		DeptID:   dept.ID,
		StaffNo:  staffNo,
		Name:     "有评审班主任",
		Phone:    phone,
		ClassIDs: []uint{class.ID},
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
	if created.Data.UserID == nil {
		t.Fatal("expected login user")
	}
	stu := model.Student{DeptID: dept.ID, ClassID: class.ID, StudentNo: "ST" + suffix, Name: "占位", Gender: "男", IDCard: uniqueValidIDCard()}
	if err := db.Create(&stu).Error; err != nil {
		t.Fatalf("create student: %v", err)
	}
	rec := model.RecognitionApplication{StudentID: stu.ID, Year: 2098, Status: model.StatusPendingClass}
	if err := db.Create(&rec).Error; err != nil {
		t.Fatalf("create recognition: %v", err)
	}
	review := model.ReviewRecord{ApplicationID: rec.ID, ReviewerID: *created.Data.UserID, Action: model.ActionPass}
	if err := db.Create(&review).Error; err != nil {
		t.Fatalf("create review: %v", err)
	}
	t.Cleanup(func() {
		db.Unscoped().Where("id = ?", review.ID).Delete(&model.ReviewRecord{})
		db.Unscoped().Where("id = ?", rec.ID).Delete(&model.RecognitionApplication{})
		db.Unscoped().Where("id = ?", stu.ID).Delete(&model.Student{})
		db.Where("advisor_id = ?", created.Data.ID).Delete(&model.AdvisorClass{})
		db.Unscoped().Where("id = ?", created.Data.ID).Delete(&model.Advisor{})
		db.Unscoped().Where("id = ?", *created.Data.UserID).Delete(&model.User{})
	})

	w = doJSON(t, r, http.MethodDelete, fmt.Sprintf("/api/v1/advisors/%d", created.Data.ID), token, nil)
	if w.Code != http.StatusConflict {
		t.Fatalf("delete with reviews expect 409, got %d body %s", w.Code, w.Body.String())
	}
	if err := db.First(&model.Advisor{}, created.Data.ID).Error; err != nil {
		t.Fatalf("advisor should remain: %v", err)
	}
}

func TestImportAdvisorsRestoresDeleted(t *testing.T) {
	r, db := setupAdvisorRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")
	dept, _, _ := seedStudentOrgRefs(t, db)

	suffix := fmt.Sprintf("%d", time.Now().UnixNano()%100000)
	staffNo := fmt.Sprintf("I%s", suffix)
	adv := model.Advisor{DeptID: dept.ID, StaffNo: staffNo, Name: "旧班主任", Phone: "13900002222"}
	if err := db.Create(&adv).Error; err != nil {
		t.Fatalf("create advisor: %v", err)
	}
	if err := db.Delete(&adv).Error; err != nil {
		t.Fatalf("soft-delete advisor: %v", err)
	}
	t.Cleanup(func() {
		db.Where("advisor_id = ?", adv.ID).Delete(&model.AdvisorClass{})
		db.Unscoped().Where("id = ?", adv.ID).Delete(&model.Advisor{})
	})

	xlsx := buildXLSX(t, [][]any{
		{"系部", "教工号", "姓名", "电话", "班级名称", "专业", "年级"},
		{dept.Name, staffNo, "复活班主任", "13900002222", "", "", ""},
	})
	w := uploadXLSX(t, r, "/api/v1/import/advisors", token, xlsx)
	if w.Code != http.StatusOK {
		t.Fatalf("import status %d, body %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data dto.ImportResult `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Data.Failed != 0 || resp.Data.Success != 1 {
		t.Fatalf("import should restore deleted advisor, got %+v", resp.Data)
	}
	var restored model.Advisor
	if err := db.First(&restored, adv.ID).Error; err != nil {
		t.Fatalf("advisor should be restored: %v", err)
	}
	if restored.Name != "复活班主任" {
		t.Fatalf("restored name want 复活班主任, got %s", restored.Name)
	}
}

func TestImportAdvisorsRestoresDeletedUsername(t *testing.T) {
	r, db := setupAdvisorRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")
	dept, _, _ := seedStudentOrgRefs(t, db)

	suffix := fmt.Sprintf("%d", time.Now().UnixNano()%100000)
	staffNo := fmt.Sprintf("U%s", suffix)
	u := model.User{
		Username: staffNo, PasswordHash: "x", RealName: "旧登录",
		Role: model.RoleClassAdvisor, Status: 1,
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := db.Delete(&u).Error; err != nil {
		t.Fatalf("soft-delete user: %v", err)
	}
	t.Cleanup(func() {
		db.Where("staff_no = ?", staffNo).Delete(&model.AdvisorClass{})
		db.Unscoped().Where("staff_no = ?", staffNo).Delete(&model.Advisor{})
		db.Unscoped().Where("id = ?", u.ID).Delete(&model.User{})
	})

	xlsx := buildXLSX(t, [][]any{
		{"系部", "教工号", "姓名", "电话", "班级名称", "专业", "年级"},
		{dept.Name, staffNo, "新导班主任", "13900003333", "", "", ""},
	})
	w := uploadXLSX(t, r, "/api/v1/import/advisors", token, xlsx)
	if w.Code != http.StatusOK {
		t.Fatalf("import status %d, body %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data dto.ImportResult `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Data.Failed != 0 || resp.Data.Success != 1 {
		t.Fatalf("import should restore deleted username, got %+v", resp.Data)
	}
	var live model.User
	if err := db.Where("username = ?", staffNo).First(&live).Error; err != nil {
		t.Fatalf("username should be restored: %v", err)
	}
	if live.ID != u.ID {
		t.Fatalf("should reuse soft-deleted user %d, got %d", u.ID, live.ID)
	}
	if live.RealName != "新导班主任" {
		t.Fatalf("restored user name want 新导班主任, got %s", live.RealName)
	}
	w = doJSON(t, r, http.MethodPost, "/api/v1/auth/login", "", dto.LoginRequest{
		Username: staffNo, Password: "Adv003333",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("login with initial password Adv003333 expect 200, got %d body %s", w.Code, w.Body.String())
	}
}
