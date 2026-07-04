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

// setupReviewRouter 构建模块 4 + 模块 5 路由，与生产 router 的鉴权保持一致。
func setupReviewRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
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
	recs.POST("", h.CreateRecognition)
	recs.GET("/:id", h.GetRecognition)
	recs.PUT("/:id", h.UpdateRecognition)
	recs.POST("/:id/submit", h.SubmitRecognition)

	reviewer := secured.Group("")
	reviewer.Use(middleware.RequireRoles(
		model.RoleClassAdvisor, model.RoleDepartment, model.RoleAidCenter, model.RoleAdmin,
	))
	reviews := reviewer.Group("/reviews")
	reviews.GET("/todo", h.ListReviewTodo)
	reviews.GET("/records", h.ListReviewRecords)
	reviews.POST("/batch", h.BatchReview)
	reviews.GET("/:id", h.GetReviewDetail)
	reviews.POST("/:id/pass", h.PassReview)
	reviews.POST("/:id/reject", h.RejectReview)
	reviews.POST("/:id/withdraw", h.WithdrawReview)

	return r, db
}

// seedScopedStudent 创建带班级/院系归属的学生（用于评审数据范围）。
func seedScopedStudent(t *testing.T, db *gorm.DB, userID, classID, deptID uint) *model.Student {
	t.Helper()
	s := seedStudentFor(t, db, userID)
	if err := db.Model(s).Updates(map[string]any{"class_id": classID, "dept_id": deptID}).Error; err != nil {
		t.Fatalf("update student scope: %v", err)
	}
	s.ClassID = classID
	s.DeptID = deptID
	return s
}

// seedReviewer 创建带数据范围的评审账号。
func seedReviewer(t *testing.T, db *gorm.DB, role model.Role, classID, deptID uint) *model.User {
	t.Helper()
	u := seedUser(t, db, "pass123", role)
	updates := map[string]any{}
	if classID > 0 {
		updates["class_id"] = classID
	}
	if deptID > 0 {
		updates["dept_id"] = deptID
	}
	if len(updates) > 0 {
		if err := db.Model(u).Updates(updates).Error; err != nil {
			t.Fatalf("update reviewer scope: %v", err)
		}
	}
	return u
}

// submitDraft 由学生创建并提交一份申请，返回申请 ID。
func submitDraft(t *testing.T, r *gin.Engine, token string, year int) uint {
	t.Helper()
	w := doJSON(t, r, http.MethodPost, "/api/v1/recognitions", token, validRecognitionReq(year))
	if w.Code != http.StatusOK {
		t.Fatalf("create draft status %d, body %s", w.Code, w.Body.String())
	}
	var createResp struct {
		Data dto.RecognitionResponse `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &createResp)
	id := createResp.Data.ID
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/recognitions/%d/submit", id), token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("submit status %d, body %s", w.Code, w.Body.String())
	}
	return id
}

func decodeRecognition(t *testing.T, w *struct {
	Data dto.RecognitionResponse `json:"data"`
}, body []byte) {
	t.Helper()
	if err := json.Unmarshal(body, w); err != nil {
		t.Fatalf("decode recognition: %v", err)
	}
}

func TestReviewWorkflowFullPass(t *testing.T) {
	r, db := setupReviewRouter(t)
	seedRecognitionDicts(db)

	base := uint(time.Now().UnixNano() % 1000000)
	classID, deptID := base+1, base+2

	stuUser := seedUser(t, db, "pass123", model.RoleStudent)
	seedScopedStudent(t, db, stuUser.ID, classID, deptID)
	stuToken := loginToken(t, r, stuUser.Username, "pass123")

	advisor := seedReviewer(t, db, model.RoleClassAdvisor, classID, deptID)
	advisorToken := loginToken(t, r, advisor.Username, "pass123")
	deptUser := seedReviewer(t, db, model.RoleDepartment, 0, deptID)
	deptToken := loginToken(t, r, deptUser.Username, "pass123")
	aidUser := seedReviewer(t, db, model.RoleAidCenter, 0, 0)
	aidToken := loginToken(t, r, aidUser.Username, "pass123")

	year := int(time.Now().UnixNano() % 100000)
	id := submitDraft(t, r, stuToken, year)

	// 待办：班主任应看到该申请
	w := doJSON(t, r, http.MethodGet, "/api/v1/reviews/todo", advisorToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("advisor todo status %d, body %s", w.Code, w.Body.String())
	}
	var todoResp struct {
		Data dto.PageResult[dto.RecognitionListItem] `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &todoResp)
	if todoResp.Data.Total < 1 {
		t.Fatalf("advisor todo expect >=1, got %d", todoResp.Data.Total)
	}

	// 班级通过须带困难等级：不带应 400
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/pass", id), advisorToken, dto.ReviewActionRequest{})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("class pass without difficulty expect 400, got %d, body %s", w.Code, w.Body.String())
	}

	// 班级通过（初定一般困难）→ pending_dept
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/pass", id), advisorToken,
		dto.ReviewActionRequest{DifficultyLevel: "general", Opinion: "属实，建议一般困难"})
	if w.Code != http.StatusOK {
		t.Fatalf("class pass status %d, body %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data dto.RecognitionResponse `json:"data"`
	}
	decodeRecognition(t, &resp, w.Body.Bytes())
	if resp.Data.Status != string(model.StatusPendingDept) {
		t.Fatalf("expect pending_dept, got %s", resp.Data.Status)
	}

	// 班主任不能再处理（已到系级）→ 403
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/pass", id), advisorToken,
		dto.ReviewActionRequest{DifficultyLevel: "general"})
	if w.Code != http.StatusForbidden {
		t.Fatalf("advisor act on dept-level expect 403, got %d", w.Code)
	}

	// 教学系通过 → pending_college
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/pass", id), deptToken,
		dto.ReviewActionRequest{Opinion: "同意"})
	if w.Code != http.StatusOK {
		t.Fatalf("dept pass status %d, body %s", w.Code, w.Body.String())
	}
	decodeRecognition(t, &resp, w.Body.Bytes())
	if resp.Data.Status != string(model.StatusPendingCollege) {
		t.Fatalf("expect pending_college, got %s", resp.Data.Status)
	}

	// 院级通过 → approved（院级为终审）
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/pass", id), aidToken,
		dto.ReviewActionRequest{Opinion: "复核通过，认定完成"})
	if w.Code != http.StatusOK {
		t.Fatalf("college pass status %d, body %s", w.Code, w.Body.String())
	}
	decodeRecognition(t, &resp, w.Body.Bytes())
	if resp.Data.Status != string(model.StatusApproved) {
		t.Fatalf("expect approved, got %s", resp.Data.Status)
	}
	if resp.Data.DifficultyLevel != "general" {
		t.Fatalf("expect difficulty general, got %s", resp.Data.DifficultyLevel)
	}
	if len(resp.Data.Reviews) != 3 {
		t.Fatalf("expect 3 review records, got %d", len(resp.Data.Reviews))
	}
}

func TestReviewRejectToStudentAndResubmit(t *testing.T) {
	r, db := setupReviewRouter(t)
	seedRecognitionDicts(db)

	base := uint(time.Now().UnixNano() % 1000000)
	classID, deptID := base+11, base+12

	stuUser := seedUser(t, db, "pass123", model.RoleStudent)
	seedScopedStudent(t, db, stuUser.ID, classID, deptID)
	stuToken := loginToken(t, r, stuUser.Username, "pass123")

	advisor := seedReviewer(t, db, model.RoleClassAdvisor, classID, deptID)
	advisorToken := loginToken(t, r, advisor.Username, "pass123")

	year := int(time.Now().UnixNano() % 100000)
	id := submitDraft(t, r, stuToken, year)

	// 退回无意见应 400
	w := doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/reject", id), advisorToken,
		dto.ReviewActionRequest{})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("reject without opinion expect 400, got %d", w.Code)
	}

	// 退回到学生（reject_to_level=0）
	level0 := 0
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/reject", id), advisorToken,
		dto.ReviewActionRequest{Opinion: "材料不全，请补充低保证明", RejectToLevel: &level0})
	if w.Code != http.StatusOK {
		t.Fatalf("reject status %d, body %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data dto.RecognitionResponse `json:"data"`
	}
	decodeRecognition(t, &resp, w.Body.Bytes())
	if resp.Data.Status != string(model.StatusRejected) {
		t.Fatalf("expect rejected, got %s", resp.Data.Status)
	}
	if resp.Data.RejectReason == "" {
		t.Fatalf("expect reject reason set")
	}

	// 学生修改后可重新提交 → pending_class
	w = doJSON(t, r, http.MethodPut, fmt.Sprintf("/api/v1/recognitions/%d", id), stuToken, validRecognitionReq(year))
	if w.Code != http.StatusOK {
		t.Fatalf("student edit rejected status %d, body %s", w.Code, w.Body.String())
	}
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/recognitions/%d/submit", id), stuToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("resubmit status %d, body %s", w.Code, w.Body.String())
	}
}

func TestReviewScopeIsolation(t *testing.T) {
	r, db := setupReviewRouter(t)
	seedRecognitionDicts(db)

	base := uint(time.Now().UnixNano() % 1000000)
	classID, deptID := base+21, base+22

	stuUser := seedUser(t, db, "pass123", model.RoleStudent)
	seedScopedStudent(t, db, stuUser.ID, classID, deptID)
	stuToken := loginToken(t, r, stuUser.Username, "pass123")

	year := int(time.Now().UnixNano() % 100000)
	id := submitDraft(t, r, stuToken, year)

	// 另一个班级的班主任无权处理 → 404（不在数据范围）
	otherAdvisor := seedReviewer(t, db, model.RoleClassAdvisor, classID+999, deptID+999)
	otherToken := loginToken(t, r, otherAdvisor.Username, "pass123")
	w := doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/pass", id), otherToken,
		dto.ReviewActionRequest{DifficultyLevel: "general"})
	if w.Code != http.StatusNotFound {
		t.Fatalf("out-of-scope advisor expect 404, got %d, body %s", w.Code, w.Body.String())
	}

	// 学生无权访问评审接口 → 403（角色拦截）
	w = doJSON(t, r, http.MethodGet, "/api/v1/reviews/todo", stuToken, nil)
	if w.Code != http.StatusForbidden {
		t.Fatalf("student access reviews expect 403, got %d", w.Code)
	}
}

func TestReviewRecordsAndDraftHidden(t *testing.T) {
	r, db := setupReviewRouter(t)
	seedRecognitionDicts(db)

	base := uint(time.Now().UnixNano() % 1000000)
	classID, deptID := base+31, base+32

	stuUser := seedUser(t, db, "pass123", model.RoleStudent)
	seedScopedStudent(t, db, stuUser.ID, classID, deptID)
	stuToken := loginToken(t, r, stuUser.Username, "pass123")

	advisor := seedReviewer(t, db, model.RoleClassAdvisor, classID, deptID)
	advisorToken := loginToken(t, r, advisor.Username, "pass123")

	year := int(time.Now().UnixNano() % 100000)
	// 仅创建草稿，不提交
	w := doJSON(t, r, http.MethodPost, "/api/v1/recognitions", stuToken, validRecognitionReq(year))
	if w.Code != http.StatusOK {
		t.Fatalf("create draft status %d, body %s", w.Code, w.Body.String())
	}
	var createResp struct {
		Data dto.RecognitionResponse `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &createResp)
	draftID := createResp.Data.ID

	// 认定记录（全部）不含草稿
	w = doJSON(t, r, http.MethodGet, "/api/v1/reviews/records?tab=all", advisorToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("records all status %d, body %s", w.Code, w.Body.String())
	}
	var listResp struct {
		Data dto.PageResult[dto.RecognitionListItem] `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &listResp)
	for _, item := range listResp.Data.Items {
		if item.ID == draftID {
			t.Fatalf("advisor should not see draft in records/all")
		}
	}

	// 提交后：待办可见，通过后进入已审核
	submittedID := submitDraft(t, r, stuToken, year+1)

	w = doJSON(t, r, http.MethodGet, "/api/v1/reviews/records?tab=todo", advisorToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("records todo status %d", w.Code)
	}
	json.Unmarshal(w.Body.Bytes(), &listResp)
	found := false
	for _, item := range listResp.Data.Items {
		if item.ID == submittedID {
			found = true
		}
	}
	if !found {
		t.Fatalf("submitted application should appear in records/todo")
	}

	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/pass", submittedID), advisorToken,
		dto.ReviewActionRequest{DifficultyLevel: "general"})
	if w.Code != http.StatusOK {
		t.Fatalf("class pass status %d, body %s", w.Code, w.Body.String())
	}

	w = doJSON(t, r, http.MethodGet, "/api/v1/reviews/records?tab=done", advisorToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("records done status %d", w.Code)
	}
	json.Unmarshal(w.Body.Bytes(), &listResp)
	found = false
	for _, item := range listResp.Data.Items {
		if item.ID == submittedID {
			found = true
		}
	}
	if !found {
		t.Fatalf("passed application should appear in records/done for advisor")
	}

	w = doJSON(t, r, http.MethodGet, "/api/v1/reviews/records?tab=todo", advisorToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("records todo after pass status %d", w.Code)
	}
	json.Unmarshal(w.Body.Bytes(), &listResp)
	for _, item := range listResp.Data.Items {
		if item.ID == submittedID {
			t.Fatalf("passed application should not remain in records/todo")
		}
	}
}

func TestReviewRecordsTodoDoneByRole(t *testing.T) {
	r, db := setupReviewRouter(t)
	seedRecognitionDicts(db)

	base := uint(time.Now().UnixNano() % 1000000)
	classID, deptID := base+41, base+42

	stuUser := seedUser(t, db, "pass123", model.RoleStudent)
	seedScopedStudent(t, db, stuUser.ID, classID, deptID)
	stuToken := loginToken(t, r, stuUser.Username, "pass123")

	advisor := seedReviewer(t, db, model.RoleClassAdvisor, classID, deptID)
	advisorToken := loginToken(t, r, advisor.Username, "pass123")
	deptUser := seedReviewer(t, db, model.RoleDepartment, 0, deptID)
	deptToken := loginToken(t, r, deptUser.Username, "pass123")

	year := int(time.Now().UnixNano() % 100000)
	submittedID := submitDraft(t, r, stuToken, year)

	containsID := func(items []dto.RecognitionListItem, id uint) bool {
		for _, item := range items {
			if item.ID == id {
				return true
			}
		}
		return false
	}

	var listResp struct {
		Data dto.PageResult[dto.RecognitionListItem] `json:"data"`
	}

	// 待班级审核：教学系应在「待审核」可见（下级正在审核），不在「已审核」
	w := doJSON(t, r, http.MethodGet, "/api/v1/reviews/records?tab=todo", deptToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("dept records todo (pending_class) status %d", w.Code)
	}
	json.Unmarshal(w.Body.Bytes(), &listResp)
	if !containsID(listResp.Data.Items, submittedID) {
		t.Fatalf("pending_class should appear in dept records/todo")
	}

	w = doJSON(t, r, http.MethodGet, "/api/v1/reviews/records?tab=done", deptToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("dept records done (pending_class) status %d", w.Code)
	}
	json.Unmarshal(w.Body.Bytes(), &listResp)
	if containsID(listResp.Data.Items, submittedID) {
		t.Fatalf("pending_class should not appear in dept records/done before dept review")
	}

	// 班级通过后：班主任进入「已审核」，教学系仍在「待审核」（本级待办）
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/pass", submittedID), advisorToken,
		dto.ReviewActionRequest{DifficultyLevel: "general"})
	if w.Code != http.StatusOK {
		t.Fatalf("class pass status %d, body %s", w.Code, w.Body.String())
	}

	w = doJSON(t, r, http.MethodGet, "/api/v1/reviews/records?tab=done", advisorToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("advisor records done after pass status %d", w.Code)
	}
	json.Unmarshal(w.Body.Bytes(), &listResp)
	if !containsID(listResp.Data.Items, submittedID) {
		t.Fatalf("advisor should see class-reviewed application in records/done")
	}

	w = doJSON(t, r, http.MethodGet, "/api/v1/reviews/records?tab=todo", deptToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("dept records todo (pending_dept) status %d", w.Code)
	}
	json.Unmarshal(w.Body.Bytes(), &listResp)
	if !containsID(listResp.Data.Items, submittedID) {
		t.Fatalf("pending_dept should appear in dept records/todo")
	}

	w = doJSON(t, r, http.MethodGet, "/api/v1/reviews/records?tab=done", deptToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("dept records done (pending_dept) status %d", w.Code)
	}
	json.Unmarshal(w.Body.Bytes(), &listResp)
	if containsID(listResp.Data.Items, submittedID) {
		t.Fatalf("pending_dept should not appear in dept records/done before dept review")
	}

	// 教学系通过后：教学系进入「已审核」
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/pass", submittedID), deptToken,
		dto.ReviewActionRequest{Opinion: "同意"})
	if w.Code != http.StatusOK {
		t.Fatalf("dept pass status %d, body %s", w.Code, w.Body.String())
	}

	w = doJSON(t, r, http.MethodGet, "/api/v1/reviews/records?tab=done", deptToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("dept records done after pass status %d", w.Code)
	}
	json.Unmarshal(w.Body.Bytes(), &listResp)
	if !containsID(listResp.Data.Items, submittedID) {
		t.Fatalf("dept should see dept-reviewed application in records/done")
	}
}

func TestReviewWithdrawPass(t *testing.T) {
	r, db := setupReviewRouter(t)
	seedRecognitionDicts(db)

	base := uint(time.Now().UnixNano() % 1000000)
	classID, deptID := base+51, base+52

	stuUser := seedUser(t, db, "pass123", model.RoleStudent)
	seedScopedStudent(t, db, stuUser.ID, classID, deptID)
	stuToken := loginToken(t, r, stuUser.Username, "pass123")

	advisor := seedReviewer(t, db, model.RoleClassAdvisor, classID, deptID)
	advisorToken := loginToken(t, r, advisor.Username, "pass123")
	deptUser := seedReviewer(t, db, model.RoleDepartment, 0, deptID)
	deptToken := loginToken(t, r, deptUser.Username, "pass123")

	year := int(time.Now().UnixNano() % 100000)
	id := submitDraft(t, r, stuToken, year)

	// 班级通过后撤回 → 恢复待班级评审
	w := doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/pass", id), advisorToken,
		dto.ReviewActionRequest{DifficultyLevel: "general"})
	if w.Code != http.StatusOK {
		t.Fatalf("class pass status %d, body %s", w.Code, w.Body.String())
	}

	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/withdraw", id), advisorToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("class withdraw status %d, body %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data dto.RecognitionResponse `json:"data"`
	}
	decodeRecognition(t, &resp, w.Body.Bytes())
	if resp.Data.Status != string(model.StatusPendingClass) {
		t.Fatalf("expect pending_class after withdraw, got %s", resp.Data.Status)
	}
	if resp.Data.DifficultyLevel != "" {
		t.Fatalf("expect empty difficulty after class withdraw, got %s", resp.Data.DifficultyLevel)
	}
	if len(resp.Data.Reviews) != 0 {
		t.Fatalf("expect no review records after withdraw, got %d", len(resp.Data.Reviews))
	}

	// 教学系通过后，班主任不可再撤回
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/pass", id), advisorToken,
		dto.ReviewActionRequest{DifficultyLevel: "general"})
	if w.Code != http.StatusOK {
		t.Fatalf("class pass again status %d", w.Code)
	}
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/pass", id), deptToken,
		dto.ReviewActionRequest{Opinion: "同意"})
	if w.Code != http.StatusOK {
		t.Fatalf("dept pass status %d", w.Code)
	}
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/withdraw", id), advisorToken, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("class withdraw after dept pass expect 400, got %d, body %s", w.Code, w.Body.String())
	}
}

func TestReviewWithdrawReject(t *testing.T) {
	r, db := setupReviewRouter(t)
	seedRecognitionDicts(db)

	base := uint(time.Now().UnixNano() % 1000000)
	classID, deptID := base+61, base+62

	stuUser := seedUser(t, db, "pass123", model.RoleStudent)
	seedScopedStudent(t, db, stuUser.ID, classID, deptID)
	stuToken := loginToken(t, r, stuUser.Username, "pass123")

	advisor := seedReviewer(t, db, model.RoleClassAdvisor, classID, deptID)
	advisorToken := loginToken(t, r, advisor.Username, "pass123")
	deptUser := seedReviewer(t, db, model.RoleDepartment, 0, deptID)
	deptToken := loginToken(t, r, deptUser.Username, "pass123")

	year := int(time.Now().UnixNano() % 100000)
	id := submitDraft(t, r, stuToken, year)

	w := doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/pass", id), advisorToken,
		dto.ReviewActionRequest{DifficultyLevel: "general"})
	if w.Code != http.StatusOK {
		t.Fatalf("class pass status %d", w.Code)
	}

	// 教学系退回班级后撤回 → 恢复待教学系评审
	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/reject", id), deptToken,
		dto.ReviewActionRequest{RejectToLevel: ptrInt(1), Opinion: "材料需补充"})
	if w.Code != http.StatusOK {
		t.Fatalf("dept reject status %d, body %s", w.Code, w.Body.String())
	}

	w = doJSON(t, r, http.MethodPost, fmt.Sprintf("/api/v1/reviews/%d/withdraw", id), deptToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("dept withdraw reject status %d, body %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data dto.RecognitionResponse `json:"data"`
	}
	decodeRecognition(t, &resp, w.Body.Bytes())
	if resp.Data.Status != string(model.StatusPendingDept) {
		t.Fatalf("expect pending_dept after withdraw reject, got %s", resp.Data.Status)
	}
	if resp.Data.RejectReason != "" {
		t.Fatalf("expect empty reject_reason after withdraw, got %s", resp.Data.RejectReason)
	}
	if len(resp.Data.Reviews) != 1 {
		t.Fatalf("expect 1 review record (class pass) after dept withdraw, got %d", len(resp.Data.Reviews))
	}
}

func ptrInt(v int) *int { return &v }
