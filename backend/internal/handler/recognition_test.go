package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/database"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/middleware"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/pkg/jwt"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

// setupRecognitionRouter 构建模块 4（困难认定申请）路由，与生产 router 保持一致。
func setupRecognitionRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
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

	recs := secured.Group("/recognitions")
	recs.GET("", h.ListRecognitions)
	recs.POST("", h.CreateRecognition)
	recs.GET("/summary-export", h.ExportRecognitionSummary)
	recs.GET("/:id", h.GetRecognition)
	recs.PUT("/:id", h.UpdateRecognition)
	recs.DELETE("/:id", h.DeleteRecognition)
	recs.POST("/:id/submit", h.SubmitRecognition)
	recs.POST("/:id/withdraw", h.WithdrawRecognition)
	recs.GET("/:id/export", h.ExportRecognitionDocx)

	return r, db
}

func seedStudentFor(t *testing.T, db *gorm.DB, userID uint) *model.Student {
	t.Helper()
	uid := userID
	s := &model.Student{
		UserID:    &uid,
		StudentNo: fmt.Sprintf("R%d", time.Now().UnixNano()),
		Name:      "测试学生",
		IDCard:    uniqueValidIDCard(),
	}
	if err := db.Create(s).Error; err != nil {
		t.Fatalf("create student: %v", err)
	}
	t.Cleanup(func() {
		var appIDs []uint
		db.Model(&model.RecognitionApplication{}).
			Where("student_id = ?", s.ID).Pluck("id", &appIDs)
		if len(appIDs) > 0 {
			db.Unscoped().Where("application_id IN ?", appIDs).Delete(&model.FamilyMember{})
			db.Unscoped().Where("id IN ?", appIDs).Delete(&model.RecognitionApplication{})
		}
		db.Unscoped().Where("id = ?", s.ID).Delete(&model.Student{})
	})
	return s
}

func ensureDict(db *gorm.DB, typ, code, label string) {
	var d model.Dict
	db.Where(model.Dict{Type: typ, Code: code}).
		Attrs(model.Dict{Label: label}).
		FirstOrCreate(&d)
}

func seedRecognitionDicts(db *gorm.DB) {
	ensureDict(db, "nation", "han", "汉族")
	ensureDict(db, "income_source", "farming", "务农收入")
	ensureDict(db, "relation", "father", "父亲")
	ensureDict(db, "relation", "mother", "母亲")
	ensureDict(db, "occupation", "farmer", "务农")
	ensureDict(db, "health_status", "good", "良好")
	ensureDict(db, "health_status", "disabled", "残疾")
	ensureDict(db, "special_group_type", "poverty", "脱贫家庭学生")
	ensureDict(db, "special_group_type", "orphan", "孤儿")
}

// validBasicReq 构造一份可通过提交校验的请求（家庭人口 3 → 2 位成员）。
func validRecognitionReq(year int) dto.RecognitionRequest {
	return dto.RecognitionRequest{
		Year:             year,
		Nation:           "han",
		NativePlace:      "贵州省贵阳市",
		IDCard:           validIDCard,
		FamilyPopulation: 3,
		Phone:            "13800001111",
		Address:          "贵阳市花溪区某街道1号",
		HouseholdType:    "rural",
		IncomeSource:     "farming",
		OtherInfo:        "家庭收入低",
		CommitmentAgreed: true,
		FamilyMembers: []dto.FamilyMemberInput{
			{Name: "父", Age: 50, Relation: "father", Occupation: "farmer", AnnualIncome: 12000, Health: "good"},
			{Name: "母", Age: 48, Relation: "mother", Occupation: "farmer", AnnualIncome: 0, Health: "good"},
		},
	}
}

func TestRecognitionDraftUpdateSubmit(t *testing.T) {
	r, db := setupRecognitionRouter(t)
	seedRecognitionDicts(db)
	user := seedUser(t, db, "pass123", model.RoleStudent)
	seedStudentFor(t, db, user.ID)
	token := loginToken(t, r, user.Username, "pass123")
	year := int(time.Now().UnixNano() % 100000)

	// 创建草稿
	req := validRecognitionReq(year)
	w := doJSON(t, r, http.MethodPost, "/api/v1/recognitions", token, req)
	if w.Code != http.StatusOK {
		t.Fatalf("create draft status %d, body %s", w.Code, w.Body.String())
	}
	var createResp struct {
		Data dto.RecognitionResponse `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &createResp)
	id := createResp.Data.ID
	if id == 0 || createResp.Data.Status != "draft" {
		t.Fatalf("unexpected create resp: %+v", createResp.Data)
	}

	// 家庭人口与成员数不一致 → 提交应 400
	bad := req
	bad.FamilyPopulation = 5 // 需 4 位成员，但只填了 2 位
	w = doJSON(t, r, http.MethodPut, fmt.Sprintf("/api/v1/recognitions/%d", id), token, bad)
	if w.Code != http.StatusOK {
		t.Fatalf("update status %d, body %s", w.Code, w.Body.String())
	}
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/recognitions/%d/submit", id), token, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("submit with mismatch expect 400, got %d, body %s", w.Code, w.Body.String())
	}

	// 修正后提交 → 200，状态 pending_class，单薪提示
	w = doJSON(t, r, http.MethodPut, fmt.Sprintf("/api/v1/recognitions/%d", id), token, req)
	if w.Code != http.StatusOK {
		t.Fatalf("fix update status %d, body %s", w.Code, w.Body.String())
	}
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/recognitions/%d/submit", id), token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("submit status %d, body %s", w.Code, w.Body.String())
	}
	var submitResp struct {
		Data dto.SubmitResult `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &submitResp)
	if submitResp.Data.Application.Status != "pending_class" {
		t.Fatalf("expect pending_class, got %s", submitResp.Data.Application.Status)
	}
	// 人均年收入自动计算：12000 / 3 = 4000
	if submitResp.Data.Application.PerCapitaAnnualIncome != 4000 {
		t.Fatalf("expect per-capita 4000, got %v", submitResp.Data.Application.PerCapitaAnnualIncome)
	}
	// 父母均在列但仅一方有收入 → 单薪提示
	if len(submitResp.Data.Warnings) == 0 {
		t.Fatalf("expect single-income warning, got none")
	}

	// 已提交不可再修改
	w = doJSON(t, r, http.MethodPut, fmt.Sprintf("/api/v1/recognitions/%d", id), token, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("update after submit expect 400, got %d", w.Code)
	}
}

func TestRecognitionCreateRequiresStudent(t *testing.T) {
	r, db := setupRecognitionRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	w := doJSON(t, r, http.MethodPost, "/api/v1/recognitions", token, validRecognitionReq(2024))
	if w.Code != http.StatusForbidden {
		t.Fatalf("admin create recognition expect 403, got %d, body %s", w.Code, w.Body.String())
	}
}

func TestRecognitionSelfScopeIsolation(t *testing.T) {
	r, db := setupRecognitionRouter(t)
	seedRecognitionDicts(db)
	userA := seedUser(t, db, "pass123", model.RoleStudent)
	seedStudentFor(t, db, userA.ID)
	tokenA := loginToken(t, r, userA.Username, "pass123")

	userB := seedUser(t, db, "pass123", model.RoleStudent)
	seedStudentFor(t, db, userB.ID)
	tokenB := loginToken(t, r, userB.Username, "pass123")

	// A 创建
	w := doJSON(t, r, http.MethodPost, "/api/v1/recognitions", tokenA, validRecognitionReq(int(time.Now().UnixNano()%100000)))
	if w.Code != http.StatusOK {
		t.Fatalf("A create status %d, body %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data dto.RecognitionResponse `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)

	// B 不能看到 A 的申请
	w = doJSON(t, r, http.MethodGet, fmt.Sprintf("/api/v1/recognitions/%d", resp.Data.ID), tokenB, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("B access A's app expect 404, got %d", w.Code)
	}
}

func TestRecognitionWithdraw(t *testing.T) {
	r, db := setupRecognitionRouter(t)
	seedRecognitionDicts(db)
	user := seedUser(t, db, "pass123", model.RoleStudent)
	seedStudentFor(t, db, user.ID)
	token := loginToken(t, r, user.Username, "pass123")
	year := int(time.Now().UnixNano() % 100000)

	req := validRecognitionReq(year)
	w := doJSON(t, r, http.MethodPost, "/api/v1/recognitions", token, req)
	if w.Code != http.StatusOK {
		t.Fatalf("create draft status %d, body %s", w.Code, w.Body.String())
	}
	var createResp struct {
		Data dto.RecognitionResponse `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &createResp)
	id := createResp.Data.ID

	// 提交后待班级评审 → 可撤回
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/recognitions/%d/submit", id), token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("submit status %d, body %s", w.Code, w.Body.String())
	}
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/recognitions/%d/withdraw", id), token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("withdraw status %d, body %s", w.Code, w.Body.String())
	}
	var withdrawResp struct {
		Data dto.RecognitionResponse `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &withdrawResp)
	if withdrawResp.Data.Status != "draft" {
		t.Fatalf("expect draft after withdraw, got %s", withdrawResp.Data.Status)
	}

	// 再次提交后模拟班级审核完成 → 不可撤回
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/recognitions/%d/submit", id), token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("resubmit status %d, body %s", w.Code, w.Body.String())
	}
	advisor := seedUser(t, db, "pass123", model.RoleClassAdvisor)
	if err := db.Create(&model.ReviewRecord{
		ApplicationID:   id,
		Level:           model.LevelClass,
		ReviewerID:      advisor.ID,
		Action:          model.ActionPass,
		DifficultyLevel: model.DifficultyGeneral,
	}).Error; err != nil {
		t.Fatalf("seed class review: %v", err)
	}
	if err := db.Model(&model.RecognitionApplication{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":           model.StatusPendingDept,
		"current_level":    model.LevelDepartment,
		"difficulty_level": model.DifficultyGeneral,
	}).Error; err != nil {
		t.Fatalf("update status after class review: %v", err)
	}
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/recognitions/%d/withdraw", id), token, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("withdraw after class review expect 400, got %d, body %s", w.Code, w.Body.String())
	}
}

func TestExportRecognitionSummary(t *testing.T) {
	r, db := setupRecognitionRouter(t)
	seedRecognitionDicts(db)

	dept, major, class := seedStudentOrgRefs(t, db)
	stuUser := seedUser(t, db, "pass123", model.RoleStudent)
	stu := seedScopedStudent(t, db, stuUser.ID, class.ID, dept.ID)
	if err := db.Model(stu).Updates(map[string]any{
		"name": "汇总学生", "gender": "男", "nation": "han", "major_id": major.ID,
	}).Error; err != nil {
		t.Fatalf("update student: %v", err)
	}

	app := model.RecognitionApplication{
		StudentID:       stu.ID,
		Year:            2026,
		Nation:          "han",
		IDCard:          stu.IDCard,
		Phone:           "13800001111",
		Address:         "兴义市测试路1号",
		SpecialTypes:    "poverty,orphan",
		Status:          model.StatusApproved,
		DifficultyLevel: model.DifficultySpecial,
	}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create approved app: %v", err)
	}

	studentToken := loginToken(t, r, stuUser.Username, "pass123")
	w := doJSON(t, r, http.MethodGet, "/api/v1/recognitions/summary-export?year=2026", studentToken, nil)
	if w.Code != http.StatusForbidden {
		t.Fatalf("student export expect 403, got %d body %s", w.Code, w.Body.String())
	}

	advisor := seedReviewer(t, db, model.RoleClassAdvisor, class.ID, dept.ID)
	advisorToken := loginToken(t, r, advisor.Username, "pass123")
	req := httptest.NewRequest(http.MethodGet, "/api/v1/recognitions/summary-export?year=2026", nil)
	req.Header.Set("Authorization", "Bearer "+advisorToken)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("advisor export status %d, body %s", w.Code, w.Body.String())
	}
	if ct := w.Header().Get("Content-Type"); ct != xlsxContentType {
		t.Fatalf("content-type want %s, got %s", xlsxContentType, ct)
	}
	if !bytes.Contains([]byte(w.Header().Get("Content-Disposition")), []byte("filename*=UTF-8''")) {
		t.Fatalf("missing utf-8 filename in disposition: %s", w.Header().Get("Content-Disposition"))
	}

	f, err := excelize.OpenReader(bytes.NewReader(w.Body.Bytes()))
	if err != nil {
		t.Fatalf("open xlsx: %v", err)
	}
	defer f.Close()
	name, err := f.GetCellValue("Sheet1", "C4")
	if err != nil {
		t.Fatalf("C4: %v", err)
	}
	if name != "汇总学生" {
		t.Fatalf("exported name want 汇总学生, got %q", name)
	}
	basis, _ := f.GetCellValue("Sheet1", "L4")
	if basis != "脱贫家庭学生、孤儿" {
		t.Fatalf("basis want 脱贫家庭学生、孤儿, got %q", basis)
	}

	other := seedReviewer(t, db, model.RoleClassAdvisor, class.ID+999, dept.ID+999)
	otherToken := loginToken(t, r, other.Username, "pass123")
	req = httptest.NewRequest(http.MethodGet, "/api/v1/recognitions/summary-export?year=2026", nil)
	req.Header.Set("Authorization", "Bearer "+otherToken)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("other advisor export status %d, body %s", w.Code, w.Body.String())
	}
	f2, err := excelize.OpenReader(bytes.NewReader(w.Body.Bytes()))
	if err != nil {
		t.Fatalf("open other xlsx: %v", err)
	}
	defer f2.Close()
	otherName, _ := f2.GetCellValue("Sheet1", "C4")
	if otherName == "汇总学生" {
		t.Fatalf("other class advisor should not see this class's student")
	}
}
