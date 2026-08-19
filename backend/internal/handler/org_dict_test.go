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
	"gorm.io/gorm"
)

// setupOrgDictRouter 连接本地 PostgreSQL 并构建模块 2（组织机构/字典）路由。
// 路由结构与 internal/router 保持一致；数据库不可用时 Skip。
func setupOrgDictRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
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

	admin := secured.Group("")
	admin.Use(middleware.RequireRoles(model.RoleAdmin))

	// 与生产路由一致：组织机构/字典读取全员可读，写入仅管理员。
	readOrgs := secured.Group("/orgs")
	readOrgs.GET("/departments", h.ListDepartments)
	readOrgs.GET("/majors", h.ListMajors)
	readOrgs.GET("/grades", h.ListGrades)
	readOrgs.GET("/classes", h.ListClasses)

	writeOrgs := admin.Group("/orgs")
	writeOrgs.POST("/departments", h.CreateDepartment)
	writeOrgs.PUT("/departments/:id", h.UpdateDepartment)
	writeOrgs.DELETE("/departments/:id", h.DeleteDepartment)
	writeOrgs.POST("/majors", h.CreateMajor)
	writeOrgs.PUT("/majors/:id", h.UpdateMajor)
	writeOrgs.DELETE("/majors/:id", h.DeleteMajor)
	writeOrgs.POST("/grades", h.CreateGrade)
	writeOrgs.PUT("/grades/:id", h.UpdateGrade)
	writeOrgs.DELETE("/grades/:id", h.DeleteGrade)
	writeOrgs.POST("/classes", h.CreateClass)
	writeOrgs.PUT("/classes/:id", h.UpdateClass)
	writeOrgs.DELETE("/classes/:id", h.DeleteClass)

	readDicts := secured.Group("/dicts")
	readDicts.GET("", h.ListDictTypes)
	readDicts.GET("/:type", h.ListDictByType)

	writeDicts := admin.Group("/dicts")
	writeDicts.POST("/:type", h.CreateDict)
	writeDicts.PUT("/:type/:code", h.UpdateDict)
	writeDicts.DELETE("/:type/:code", h.DeleteDict)

	readRegs := secured.Group("/region-codes")
	readRegs.GET("", h.ListRegionCodes)
	readRegs.GET("/lookup", h.LookupRegionCode)
	readRegs.GET("/:code", h.GetRegionCode)

	writeRegs := admin.Group("/region-codes")
	writeRegs.POST("", h.CreateRegionCode)
	writeRegs.POST("/import", h.ImportRegionCodes)
	writeRegs.POST("/import-default", h.ImportDefaultRegionCodes)
	writeRegs.PUT("/:code", h.UpdateRegionCode)
	writeRegs.DELETE("/:code", h.DeleteRegionCode)

	students := admin.Group("/students")
	students.GET("", h.ListStudents)
	students.GET("/:id", h.GetStudent)
	students.POST("", h.CreateStudent)
	students.PUT("/:id", h.UpdateStudent)
	students.DELETE("/:id", h.DeleteStudent)

	sg := admin.Group("/special-groups")
	sg.GET("", h.ListSpecialGroups)
	sg.GET("/:id", h.GetSpecialGroup)
	sg.POST("", h.CreateSpecialGroup)
	sg.PUT("/:id", h.UpdateSpecialGroup)
	sg.DELETE("/:id", h.DeleteSpecialGroup)

	imp := admin.Group("/import")
	imp.GET("/template/:type", h.DownloadImportTemplate)
	imp.POST("/students", h.ImportStudents)
	imp.POST("/special-groups", h.ImportSpecialGroups)
	imp.POST("/departments", h.ImportDepartments)
	imp.POST("/majors", h.ImportMajors)
	imp.POST("/grades", h.ImportGrades)
	imp.POST("/classes", h.ImportClasses)

	exp := admin.Group("/export")
	exp.GET("/students", h.ExportStudents)
	exp.GET("/:type", h.ExportOrg)

	return r, db
}

// loginToken 通过登录获取 access token。
func loginToken(t *testing.T, r *gin.Engine, username, plainPassword string) string {
	t.Helper()
	body, _ := json.Marshal(dto.LoginRequest{Username: username, Password: plainPassword})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("login status %d, body %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data dto.TokenResponse `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode login: %v", err)
	}
	return resp.Data.AccessToken
}

// doJSON 发起带鉴权的 JSON 请求并返回响应记录器。
func doJSON(t *testing.T, r *gin.Engine, method, path, token string, payload any) *httptest.ResponseRecorder {
	t.Helper()
	var reader *bytes.Reader
	if payload != nil {
		b, _ := json.Marshal(payload)
		reader = bytes.NewReader(b)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestDepartmentCRUDAndDeleteGuard(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	deptName := fmt.Sprintf("测试院系_%d", time.Now().UnixNano())
	t.Cleanup(func() {
		db.Unscoped().Where("name = ?", deptName).Delete(&model.Department{})
	})

	// 创建院系
	w := doJSON(t, r, http.MethodPost, "/api/v1/orgs/departments", token,
		dto.DepartmentRequest{Name: deptName, Code: deptName})
	if w.Code != http.StatusOK {
		t.Fatalf("create dept status %d, body %s", w.Code, w.Body.String())
	}
	var createResp struct {
		Data dto.DepartmentResponse `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &createResp)
	deptID := createResp.Data.ID
	if deptID == 0 {
		t.Fatal("expected dept id")
	}

	// 重复 code 应 409
	w = doJSON(t, r, http.MethodPost, "/api/v1/orgs/departments", token,
		dto.DepartmentRequest{Name: deptName + "_dup", Code: deptName})
	if w.Code != http.StatusConflict {
		t.Fatalf("duplicate code expect 409, got %d, body %s", w.Code, w.Body.String())
	}

	// 在院系下建专业 -> 删除院系应被阻止（409 ErrInUse）
	majorName := fmt.Sprintf("测试专业_%d", time.Now().UnixNano())
	t.Cleanup(func() {
		db.Unscoped().Where("name = ?", majorName).Delete(&model.Major{})
	})
	w = doJSON(t, r, http.MethodPost, "/api/v1/orgs/majors", token,
		dto.MajorRequest{DeptID: deptID, Name: majorName})
	if w.Code != http.StatusOK {
		t.Fatalf("create major status %d, body %s", w.Code, w.Body.String())
	}

	w = doJSON(t, r, http.MethodDelete, fmt.Sprintf("/api/v1/orgs/departments/%d", deptID), token, nil)
	if w.Code != http.StatusConflict {
		t.Fatalf("delete dept with major expect 409, got %d, body %s", w.Code, w.Body.String())
	}
}

func TestMajorInvalidDeptRef(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	// 关联不存在的院系 -> 400 ErrInvalidRef
	w := doJSON(t, r, http.MethodPost, "/api/v1/orgs/majors", token,
		dto.MajorRequest{DeptID: 99999999, Name: "孤儿专业"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("invalid dept ref expect 400, got %d, body %s", w.Code, w.Body.String())
	}
}

func TestOrgManageForbiddenForStudent(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	student := seedUser(t, db, "pass123", model.RoleStudent)
	token := loginToken(t, r, student.Username, "pass123")

	// 读取组织机构与字典：所有登录用户均可。
	w := doJSON(t, r, http.MethodGet, "/api/v1/orgs/departments", token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("student list dept expect 200, got %d, body %s", w.Code, w.Body.String())
	}
	w = doJSON(t, r, http.MethodGet, "/api/v1/dicts", token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("student list dict types expect 200, got %d, body %s", w.Code, w.Body.String())
	}

	// 写入仍仅管理员。
	w = doJSON(t, r, http.MethodPost, "/api/v1/orgs/departments", token,
		dto.DepartmentRequest{Name: "x"})
	if w.Code != http.StatusForbidden {
		t.Fatalf("student create dept expect 403, got %d, body %s", w.Code, w.Body.String())
	}
	w = doJSON(t, r, http.MethodPost, "/api/v1/dicts/test_type", token,
		dto.DictCreateRequest{Code: "a", Label: "甲"})
	if w.Code != http.StatusForbidden {
		t.Fatalf("student create dict expect 403, got %d, body %s", w.Code, w.Body.String())
	}

	// 学生访问学生管理接口仍 403。
	w = doJSON(t, r, http.MethodGet, "/api/v1/students", token, nil)
	if w.Code != http.StatusForbidden {
		t.Fatalf("student list students expect 403, got %d, body %s", w.Code, w.Body.String())
	}
}

func TestOrgReadOnlyForClassAdvisor(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	advisor := seedUser(t, db, "pass123", model.RoleClassAdvisor)
	token := loginToken(t, r, advisor.Username, "pass123")

	w := doJSON(t, r, http.MethodGet, "/api/v1/orgs/departments", token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("advisor list dept expect 200, got %d, body %s", w.Code, w.Body.String())
	}
	w = doJSON(t, r, http.MethodPost, "/api/v1/orgs/departments", token,
		dto.DepartmentRequest{Name: "不应成功"})
	if w.Code != http.StatusForbidden {
		t.Fatalf("advisor create dept expect 403, got %d, body %s", w.Code, w.Body.String())
	}
}

func TestDictCRUD(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	dictType := fmt.Sprintf("test_type_%d", time.Now().UnixNano())
	t.Cleanup(func() {
		db.Unscoped().Where("type = ?", dictType).Delete(&model.Dict{})
	})

	// 创建
	w := doJSON(t, r, http.MethodPost, "/api/v1/dicts/"+dictType, token,
		dto.DictCreateRequest{Code: "a", Label: "甲", Sort: 1})
	if w.Code != http.StatusOK {
		t.Fatalf("create dict status %d, body %s", w.Code, w.Body.String())
	}

	// 重复 code -> 409
	w = doJSON(t, r, http.MethodPost, "/api/v1/dicts/"+dictType, token,
		dto.DictCreateRequest{Code: "a", Label: "甲2"})
	if w.Code != http.StatusConflict {
		t.Fatalf("duplicate dict expect 409, got %d, body %s", w.Code, w.Body.String())
	}

	// 列表
	w = doJSON(t, r, http.MethodGet, "/api/v1/dicts/"+dictType, token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list dict status %d", w.Code)
	}
	var listResp struct {
		Data []dto.DictResponse `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &listResp)
	if len(listResp.Data) != 1 || listResp.Data[0].Label != "甲" {
		t.Fatalf("unexpected dict list: %+v", listResp.Data)
	}

	// 修改
	w = doJSON(t, r, http.MethodPut, "/api/v1/dicts/"+dictType+"/a", token,
		dto.DictUpdateRequest{Label: "甲改", Sort: 5})
	if w.Code != http.StatusOK {
		t.Fatalf("update dict status %d, body %s", w.Code, w.Body.String())
	}

	// 删除
	w = doJSON(t, r, http.MethodDelete, "/api/v1/dicts/"+dictType+"/a", token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete dict status %d, body %s", w.Code, w.Body.String())
	}

	// 删除不存在 -> 404
	w = doJSON(t, r, http.MethodDelete, "/api/v1/dicts/"+dictType+"/a", token, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("delete missing dict expect 404, got %d", w.Code)
	}
}

func TestOrgImportExport(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	deptCode := "D" + suffix[len(suffix)-6:]
	deptName := "测试院系" + suffix[len(suffix)-4:]

	// 导入院系
	xlsx := buildXLSX(t, [][]any{
		{"院系名称", "院系编码"},
		{deptName, deptCode},
	})
	w := uploadXLSX(t, r, "/api/v1/import/departments", token, xlsx)
	if w.Code != http.StatusOK {
		t.Fatalf("import departments status %d, body %s", w.Code, w.Body.String())
	}
	var impResp struct {
		Data dto.ImportResult `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &impResp)
	if impResp.Data.Failed != 0 || impResp.Data.Success != 1 {
		t.Fatalf("import departments result: %+v", impResp.Data)
	}

	// 导入年级
	year := 2099
	xlsx = buildXLSX(t, [][]any{
		{"年级名称", "入学年份"},
		{"2099级", year},
	})
	w = uploadXLSX(t, r, "/api/v1/import/grades", token, xlsx)
	if w.Code != http.StatusOK {
		t.Fatalf("import grades status %d, body %s", w.Code, w.Body.String())
	}

	// 导入专业
	majorCode := "M" + suffix[len(suffix)-4:]
	xlsx = buildXLSX(t, [][]any{
		{"院系编码", "专业名称", "专业编码"},
		{deptCode, "测试专业", majorCode},
	})
	w = uploadXLSX(t, r, "/api/v1/import/majors", token, xlsx)
	if w.Code != http.StatusOK {
		t.Fatalf("import majors status %d, body %s", w.Code, w.Body.String())
	}

	// 导入班级
	xlsx = buildXLSX(t, [][]any{
		{"院系编码", "专业编码", "入学年份", "班级名称", "班主任用户名"},
		{deptCode, majorCode, year, "测试班" + suffix[len(suffix)-4:], ""},
	})
	w = uploadXLSX(t, r, "/api/v1/import/classes", token, xlsx)
	if w.Code != http.StatusOK {
		t.Fatalf("import classes status %d, body %s", w.Code, w.Body.String())
	}

	// 导出院系
	req := httptest.NewRequest(http.MethodGet, "/api/v1/export/departments", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("export departments status %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != xlsxContentType {
		t.Fatalf("export content-type want %s, got %s", xlsxContentType, ct)
	}
	if len(w.Body.Bytes()) < 100 {
		t.Fatalf("export file too small")
	}

	// 清理
	t.Cleanup(func() {
		db.Unscoped().Where("code = ?", deptCode).Delete(&model.Department{})
		db.Unscoped().Where("year = ?", year).Delete(&model.Grade{})
	})
}
