package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

var idCardWeights = [17]int{7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2}
var idCardCheckCodes = [11]byte{'1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'}

// validIDCard 通过校验算法的 18 位身份证（认定申请等测试共用）。
const validIDCard = "110101200001010010"

// uniqueValidIDCard 生成带合法校验码的唯一测试身份证号。
func uniqueValidIDCard() string {
	body := fmt.Sprintf("1101011990%07d", time.Now().UnixNano()%10000000)
	sum := 0
	for i := 0; i < 17; i++ {
		n, _ := strconv.Atoi(string(body[i]))
		sum += n * idCardWeights[i]
	}
	return body + string(idCardCheckCodes[sum%11])
}

// seedStudentOrgRefs 创建测试用院系/专业/年级/班级并返回对象（调用方按需用 .ID / .Name）。
func seedStudentOrgRefs(t *testing.T, db *gorm.DB) (dept model.Department, major model.Major, class model.Class) {
	t.Helper()
	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	dept = model.Department{Name: "测试院系" + suffix, Code: "TD" + suffix[len(suffix)-6:]}
	if err := db.Create(&dept).Error; err != nil {
		t.Fatalf("create test dept: %v", err)
	}
	major = model.Major{DeptID: dept.ID, Name: "测试专业", Code: "TM" + suffix[len(suffix)-4:]}
	if err := db.Create(&major).Error; err != nil {
		t.Fatalf("create test major: %v", err)
	}
	var grade model.Grade
	if err := db.Where("year = ?", 2024).First(&grade).Error; err != nil {
		grade = model.Grade{Name: "2024级", Year: 2024}
		if err := db.Create(&grade).Error; err != nil {
			t.Fatalf("create test grade: %v", err)
		}
	}
	class = model.Class{DeptID: dept.ID, MajorID: major.ID, GradeID: grade.ID, Name: "测试班" + suffix[len(suffix)-4:]}
	if err := db.Create(&class).Error; err != nil {
		t.Fatalf("create test class: %v", err)
	}
	t.Cleanup(func() {
		db.Unscoped().Where("id = ?", class.ID).Delete(&model.Class{})
		db.Unscoped().Where("id = ?", major.ID).Delete(&model.Major{})
		db.Unscoped().Where("id = ?", dept.ID).Delete(&model.Department{})
	})
	return dept, major, class
}

func validStudentReq(studentNo, name, idCard string, deptID, majorID, classID uint) dto.StudentRequest {
	return dto.StudentRequest{
		StudentNo: studentNo,
		Name:      name,
		Gender:    "男",
		IDCard:    idCard,
		DeptID:    deptID,
		MajorID:   majorID,
		ClassID:   classID,
	}
}

// uploadXLSX 以 multipart/form-data 上传 xlsx 字节到指定路径。
func uploadXLSX(t *testing.T, r *gin.Engine, path, token string, data []byte) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, err := mw.CreateFormFile("file", "data.xlsx")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := fw.Write(data); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	mw.Close()

	req := httptest.NewRequest(http.MethodPost, path, &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// buildXLSX 以给定行（含表头）构建 xlsx 字节。
func buildXLSX(t *testing.T, rows [][]any) []byte {
	t.Helper()
	f := excelize.NewFile()
	defer f.Close()
	for i, row := range rows {
		cell := fmt.Sprintf("A%d", i+1)
		if err := f.SetSheetRow("Sheet1", cell, &row); err != nil {
			t.Fatalf("set row: %v", err)
		}
	}
	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("write buffer: %v", err)
	}
	return buf.Bytes()
}

func TestStudentCRUDAndValidation(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	studentNo := fmt.Sprintf("S%d", time.Now().UnixNano())
	idCard := uniqueValidIDCard()
	dept, major, class := seedStudentOrgRefs(t, db); deptID, majorID, classID := dept.ID, major.ID, class.ID
	t.Cleanup(func() {
		db.Unscoped().Where("student_no = ?", studentNo).Delete(&model.Student{})
	})

	// 创建
	w := doJSON(t, r, http.MethodPost, "/api/v1/students", token,
		validStudentReq(studentNo, "张三", idCard, deptID, majorID, classID))
	if w.Code != http.StatusOK {
		t.Fatalf("create student status %d, body %s", w.Code, w.Body.String())
	}
	var createResp struct {
		Data dto.StudentResponse `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &createResp)
	if createResp.Data.ID == 0 {
		t.Fatal("expected student id")
	}

	// 学号重复 -> 400
	w = doJSON(t, r, http.MethodPost, "/api/v1/students", token,
		validStudentReq(studentNo, "李四", uniqueValidIDCard(), deptID, majorID, classID))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("dup student no expect 400, got %d, body %s", w.Code, w.Body.String())
	}

	// 身份证号重复 -> 400
	otherNo := fmt.Sprintf("S%d", time.Now().UnixNano())
	w = doJSON(t, r, http.MethodPost, "/api/v1/students", token,
		validStudentReq(otherNo, "王五", idCard, deptID, majorID, classID))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("dup id card expect 400, got %d, body %s", w.Code, w.Body.String())
	}

	// 非法身份证 -> 400
	req := validStudentReq(studentNo, "张三", idCard, deptID, majorID, classID)
	req.IDCard = "123"
	w = doJSON(t, r, http.MethodPut, fmt.Sprintf("/api/v1/students/%d", createResp.Data.ID), token, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("invalid id card expect 400, got %d, body %s", w.Code, w.Body.String())
	}

	// 删除
	w = doJSON(t, r, http.MethodDelete, fmt.Sprintf("/api/v1/students/%d", createResp.Data.ID), token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete student status %d", w.Code)
	}
	if err := db.Unscoped().First(&model.Student{}, createResp.Data.ID).Error; err != gorm.ErrRecordNotFound {
		t.Fatalf("student should be hard-deleted, err=%v", err)
	}
	if createResp.Data.UserID != 0 {
		if err := db.Unscoped().First(&model.User{}, createResp.Data.UserID).Error; err != gorm.ErrRecordNotFound {
			t.Fatalf("student login user should be hard-deleted, err=%v", err)
		}
	}
}

func TestDeleteStudentBlockedWhenHasApplications(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	studentNo := fmt.Sprintf("D%d", time.Now().UnixNano())
	idCard := uniqueValidIDCard()
	dept, major, class := seedStudentOrgRefs(t, db)
	w := doJSON(t, r, http.MethodPost, "/api/v1/students", token,
		validStudentReq(studentNo, "备查学生", idCard, dept.ID, major.ID, class.ID))
	if w.Code != http.StatusOK {
		t.Fatalf("create student status %d, body %s", w.Code, w.Body.String())
	}
	var created struct {
		Data dto.StudentResponse `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &created)
	stuID, userID := created.Data.ID, created.Data.UserID
	if stuID == 0 || userID == 0 {
		t.Fatalf("expected student and user id, got %+v", created.Data)
	}

	rec := model.RecognitionApplication{StudentID: stuID, Year: 2026, Status: model.StatusApproved}
	if err := db.Create(&rec).Error; err != nil {
		t.Fatalf("create recognition: %v", err)
	}
	grant := model.GrantApplication{
		StudentID: stuID, RecognitionID: rec.ID,
		GrantType: model.GrantNationalAid, Year: 2026, Status: model.GrantStatusDraft,
	}
	if err := db.Create(&grant).Error; err != nil {
		t.Fatalf("create grant: %v", err)
	}
	t.Cleanup(func() {
		db.Unscoped().Where("id = ?", grant.ID).Delete(&model.GrantApplication{})
		db.Unscoped().Where("id = ?", rec.ID).Delete(&model.RecognitionApplication{})
		db.Unscoped().Where("id = ?", stuID).Delete(&model.Student{})
		db.Unscoped().Where("id = ?", userID).Delete(&model.User{})
	})

	w = doJSON(t, r, http.MethodDelete, fmt.Sprintf("/api/v1/students/%d", stuID), token, nil)
	if w.Code != http.StatusConflict {
		t.Fatalf("delete student with applications expect 409, got %d, body %s", w.Code, w.Body.String())
	}

	if err := db.First(&model.Student{}, stuID).Error; err != nil {
		t.Fatalf("student should remain: %v", err)
	}
	if err := db.First(&model.User{}, userID).Error; err != nil {
		t.Fatalf("login user should remain: %v", err)
	}
	if err := db.First(&model.RecognitionApplication{}, rec.ID).Error; err != nil {
		t.Fatalf("recognition should remain: %v", err)
	}
	if err := db.First(&model.GrantApplication{}, grant.ID).Error; err != nil {
		t.Fatalf("grant should remain: %v", err)
	}
}

func TestSpecialGroupAutoMatch(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	studentNo := fmt.Sprintf("S%d", time.Now().UnixNano())
	idCard := uniqueValidIDCard()
	dept, major, class := seedStudentOrgRefs(t, db); deptID, majorID, classID := dept.ID, major.ID, class.ID
	t.Cleanup(func() {
		db.Unscoped().Where("student_no = ?", studentNo).Delete(&model.Student{})
		db.Unscoped().Where("student_no = ?", studentNo).Delete(&model.SpecialGroup{})
	})

	// 先导入一条重点人群名单
	w := doJSON(t, r, http.MethodPost, "/api/v1/special-groups", token,
		dto.SpecialGroupRequest{StudentNo: studentNo, Name: "张三", Type: string(model.SGOrphan), Year: 2024})
	if w.Code != http.StatusOK {
		t.Fatalf("create special group status %d, body %s", w.Code, w.Body.String())
	}

	// 再创建同学号学生 -> 应自动标记 is_key_group
	w = doJSON(t, r, http.MethodPost, "/api/v1/students", token,
		validStudentReq(studentNo, "张三", idCard, deptID, majorID, classID))
	if w.Code != http.StatusOK {
		t.Fatalf("create student status %d, body %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data dto.StudentResponse `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if !resp.Data.IsKeyGroup {
		t.Fatalf("expected is_key_group=true after matching special group")
	}
}

func TestImportStudentsRestoresDeleted(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	okNo := fmt.Sprintf("R%d", time.Now().UnixNano())
	idCard := uniqueValidIDCard()
	dept, major, class := seedStudentOrgRefs(t, db)
	w := doJSON(t, r, http.MethodPost, "/api/v1/students", token,
		validStudentReq(okNo, "待复活", idCard, dept.ID, major.ID, class.ID))
	if w.Code != http.StatusOK {
		t.Fatalf("create student %d, body %s", w.Code, w.Body.String())
	}
	var created struct {
		Data dto.StudentResponse `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &created)
	if err := db.Delete(&model.Student{}, created.Data.ID).Error; err != nil {
		t.Fatalf("soft-delete student: %v", err)
	}
	t.Cleanup(func() {
		db.Unscoped().Where("id = ?", created.Data.ID).Delete(&model.Student{})
		if created.Data.UserID != 0 {
			db.Unscoped().Where("id = ?", created.Data.UserID).Delete(&model.User{})
		}
	})

	header := []any{"学号", "姓名", "性别", "身份证号", "手机号", "民族", "政治面貌", "院系", "专业", "班级", "出生年月(YYYY-MM-DD)", "入学时间(YYYY-MM-DD)"}
	row := []any{okNo, "已复活", "男", idCard, "", "汉族", "共青团员", dept.Name, major.Name, class.Name, "", ""}
	w = uploadXLSX(t, r, "/api/v1/import/students", token, buildXLSX(t, [][]any{header, row}))
	if w.Code != http.StatusOK {
		t.Fatalf("import status %d, body %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data dto.ImportResult `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Data.Failed != 0 || resp.Data.Success != 1 {
		t.Fatalf("import should restore deleted student, got %+v", resp.Data)
	}
	var restored model.Student
	if err := db.First(&restored, created.Data.ID).Error; err != nil {
		t.Fatalf("student should be restored: %v", err)
	}
	if restored.Name != "已复活" {
		t.Fatalf("restored name want 已复活, got %s", restored.Name)
	}
}

func TestImportStudentsRestoresDeletedUsername(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	okNo := fmt.Sprintf("U%d", time.Now().UnixNano())
	idCard := uniqueValidIDCard()
	dept, major, class := seedStudentOrgRefs(t, db)
	u := model.User{
		Username: okNo, PasswordHash: "x", RealName: "旧学生",
		Role: model.RoleStudent, Status: 1,
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := db.Delete(&u).Error; err != nil {
		t.Fatalf("soft-delete user: %v", err)
	}
	t.Cleanup(func() {
		db.Unscoped().Where("student_no = ?", okNo).Delete(&model.Student{})
		db.Unscoped().Where("id = ?", u.ID).Delete(&model.User{})
	})

	header := []any{"学号", "姓名", "性别", "身份证号", "手机号", "民族", "政治面貌", "院系", "专业", "班级", "出生年月(YYYY-MM-DD)", "入学时间(YYYY-MM-DD)"}
	row := []any{okNo, "新导学生", "男", idCard, "", "汉族", "共青团员", dept.Name, major.Name, class.Name, "", ""}
	w := uploadXLSX(t, r, "/api/v1/import/students", token, buildXLSX(t, [][]any{header, row}))
	if w.Code != http.StatusOK {
		t.Fatalf("import status %d, body %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data dto.ImportResult `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Data.Failed != 0 || resp.Data.Success != 1 {
		t.Fatalf("import should restore deleted student username, got %+v", resp.Data)
	}
	var live model.User
	if err := db.Where("username = ?", okNo).First(&live).Error; err != nil {
		t.Fatalf("username should be restored: %v", err)
	}
	if live.ID != u.ID {
		t.Fatalf("should reuse soft-deleted user %d, got %d", u.ID, live.ID)
	}
}

func TestImportStudents(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	okNo := fmt.Sprintf("S%d", time.Now().UnixNano())
	idCard := uniqueValidIDCard()
	dept, major, class := seedStudentOrgRefs(t, db)
	t.Cleanup(func() {
		db.Unscoped().Where("student_no = ?", okNo).Delete(&model.Student{})
	})

	// 学生导入使用中文名称（民族、政治面貌、院系、专业、班级）
	header := []any{"学号", "姓名", "性别", "身份证号", "手机号", "民族", "政治面貌", "院系", "专业", "班级", "出生年月(YYYY-MM-DD)", "入学时间(YYYY-MM-DD)"}
	goodRow := []any{okNo, "张三", "男", idCard, "", "汉族", "共青团员", dept.Name, major.Name, class.Name, "", ""}
	badRow := []any{"", "缺学号", "男", "", "", "", "", dept.Name, major.Name, class.Name, "", ""} // 学号为空 -> 失败
	data := buildXLSX(t, [][]any{header, goodRow, badRow})

	w := uploadXLSX(t, r, "/api/v1/import/students", token, data)
	if w.Code != http.StatusOK {
		t.Fatalf("import status %d, body %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data dto.ImportResult `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Data.Total != 2 || resp.Data.Success != 1 || resp.Data.Failed != 1 {
		t.Fatalf("unexpected import result: %+v", resp.Data)
	}
	if len(resp.Data.Errors) != 1 || resp.Data.Errors[0].Row != 3 {
		t.Fatalf("expected one error on row 3, got %+v", resp.Data.Errors)
	}
}

func TestImportTemplateDownload(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	w := doJSON(t, r, http.MethodGet, "/api/v1/import/template/students", token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("template download status %d", w.Code)
	}
	if w.Body.Len() == 0 {
		t.Fatal("expected non-empty template")
	}
}

func TestExportStudents(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	studentNo := fmt.Sprintf("E%d", time.Now().UnixNano())
	idCard := uniqueValidIDCard()
	dept, major, class := seedStudentOrgRefs(t, db); deptID, majorID, classID := dept.ID, major.ID, class.ID
	t.Cleanup(func() {
		db.Unscoped().Where("student_no = ?", studentNo).Delete(&model.Student{})
	})

	// 创建学生时填民族/政治面貌 code，导出应转换为中文名称
	createReq := validStudentReq(studentNo, "导出测试", idCard, deptID, majorID, classID)
	createReq.Nation = "han"
	createReq.PoliticalStatus = "league_member"
	w := doJSON(t, r, http.MethodPost, "/api/v1/students", token, createReq)
	if w.Code != http.StatusOK {
		t.Fatalf("create student status %d, body %s", w.Code, w.Body.String())
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/export/students?keyword="+studentNo, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("export students status %d, body %s", w.Code, w.Body.String())
	}
	if ct := w.Header().Get("Content-Type"); ct != xlsxContentType {
		t.Fatalf("export content-type want %s, got %s", xlsxContentType, ct)
	}
	if len(w.Body.Bytes()) < 100 {
		t.Fatalf("export file too small")
	}

	// 解析导出 xlsx：表头应为中文名称，数据行应包含院系/专业/班级名称与民族/政治面貌中文名
	f, err := excelize.OpenReader(bytes.NewReader(w.Body.Bytes()))
	if err != nil {
		t.Fatalf("open exported xlsx: %v", err)
	}
	defer f.Close()
	rows, err := f.GetRows("Sheet1")
	if err != nil {
		t.Fatalf("read rows: %v", err)
	}
	if len(rows) < 2 {
		t.Fatalf("expected header + 1 data row, got %d", len(rows))
	}
	wantHeader := []string{"学号", "姓名", "性别", "身份证号", "手机号", "民族", "政治面貌", "院系", "专业", "班级", "出生年月(YYYY-MM-DD)", "入学时间(YYYY-MM-DD)"}
	for i, h := range wantHeader {
		if i >= len(rows[0]) || rows[0][i] != h {
			t.Fatalf("header[%d] want %q, got %q", i, h, cellAt(rows[0], i))
		}
	}
	dataRow := rows[1]
	if cellAt(dataRow, 5) != "汉族" {
		t.Fatalf("nation label want 汉族, got %q", cellAt(dataRow, 5))
	}
	if cellAt(dataRow, 6) != "共青团员" {
		t.Fatalf("political label want 共青团员, got %q", cellAt(dataRow, 6))
	}
	if cellAt(dataRow, 7) != dept.Name {
		t.Fatalf("dept name want %q, got %q", dept.Name, cellAt(dataRow, 7))
	}
	if cellAt(dataRow, 8) != major.Name {
		t.Fatalf("major name want %q, got %q", major.Name, cellAt(dataRow, 8))
	}
	if cellAt(dataRow, 9) != class.Name {
		t.Fatalf("class name want %q, got %q", class.Name, cellAt(dataRow, 9))
	}
}

func cellAt(row []string, idx int) string {
	if idx < len(row) {
		return row[idx]
	}
	return ""
}

func TestImportStudentsBadHeader(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	xlsx := buildXLSX(t, [][]any{
		{"错误表头", "姓名"},
		{"2024010199", "张三"},
	})
	w := uploadXLSX(t, r, "/api/v1/import/students", token, xlsx)
	if w.Code != http.StatusOK {
		t.Fatalf("import status %d, body %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data dto.ImportResult `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Data.Failed != 1 || len(resp.Data.Errors) != 1 {
		t.Fatalf("expected header error, got %+v", resp.Data)
	}
	if resp.Data.Errors[0].Row != 1 || resp.Data.Errors[0].Column != "表头" {
		t.Fatalf("unexpected header error: %+v", resp.Data.Errors[0])
	}
}

func decodeStudentPage(t *testing.T, body []byte) dto.PageResult[dto.StudentResponse] {
	t.Helper()
	var resp struct {
		Data dto.PageResult[dto.StudentResponse] `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		t.Fatalf("decode student page: %v body %s", err, body)
	}
	return resp.Data
}

func TestStudentRosterScopeAndProgress(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	adminToken := loginToken(t, r, admin.Username, "pass123")

	dept, major, classA := seedStudentOrgRefs(t, db)
	classB := model.Class{DeptID: dept.ID, MajorID: major.ID, GradeID: classA.GradeID, Name: "对照班" + fmt.Sprintf("%d", time.Now().UnixNano()%10000)}
	if err := db.Create(&classB).Error; err != nil {
		t.Fatalf("create class B: %v", err)
	}
	t.Cleanup(func() {
		db.Unscoped().Where("id = ?", classB.ID).Delete(&model.Class{})
	})

	year := time.Now().Year()
	noA := fmt.Sprintf("RA%d", time.Now().UnixNano())
	noA2 := fmt.Sprintf("RA2%d", time.Now().UnixNano())
	noB := fmt.Sprintf("RB%d", time.Now().UnixNano())
	idCardA := uniqueValidIDCard()

	createOne := func(no, name, card string, classID uint) uint {
		t.Helper()
		w := doJSON(t, r, http.MethodPost, "/api/v1/students", adminToken,
			validStudentReq(no, name, card, dept.ID, major.ID, classID))
		if w.Code != http.StatusOK {
			t.Fatalf("create %s status %d, body %s", no, w.Code, w.Body.String())
		}
		var resp struct {
			Data dto.StudentResponse `json:"data"`
		}
		json.Unmarshal(w.Body.Bytes(), &resp)
		t.Cleanup(func() {
			db.Unscoped().Where("student_id = ?", resp.Data.ID).Delete(&model.GrantApplication{})
			db.Unscoped().Where("student_id = ?", resp.Data.ID).Delete(&model.RecognitionApplication{})
			db.Unscoped().Where("id = ?", resp.Data.ID).Delete(&model.Student{})
		})
		return resp.Data.ID
	}
	idA := createOne(noA, "本班已报", idCardA, classA.ID)
	_ = createOne(noA2, "本班未报", uniqueValidIDCard(), classA.ID)
	idB := createOne(noB, "他班学生", uniqueValidIDCard(), classB.ID)

	rec := model.RecognitionApplication{StudentID: idA, Year: year, Status: model.StatusPendingClass}
	if err := db.Create(&rec).Error; err != nil {
		t.Fatalf("create recognition: %v", err)
	}
	grant := model.GrantApplication{
		StudentID: idA, RecognitionID: rec.ID, GrantType: model.GrantNationalAid,
		Year: year, Status: model.GrantStatusDraft,
	}
	if err := db.Create(&grant).Error; err != nil {
		t.Fatalf("create grant: %v", err)
	}

	advisor := seedReviewer(t, db, model.RoleClassAdvisor, classA.ID, dept.ID)
	advisorToken := loginToken(t, r, advisor.Username, "pass123")
	deptUser := seedReviewer(t, db, model.RoleDepartment, 0, dept.ID)
	deptToken := loginToken(t, r, deptUser.Username, "pass123")

	w := doJSON(t, r, http.MethodGet, fmt.Sprintf("/api/v1/students?keyword=%s&year=%d", noA, year), advisorToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("advisor list submitted status %d, body %s", w.Code, w.Body.String())
	}
	page := decodeStudentPage(t, w.Body.Bytes())
	if page.Total != 1 || len(page.Items) != 1 {
		t.Fatalf("advisor should see submitted classmate, got total=%d items=%d", page.Total, len(page.Items))
	}
	got := page.Items[0]
	if got.RecognitionStatus != string(model.StatusPendingClass) || got.RecognitionID != rec.ID {
		t.Fatalf("recognition progress want pending_class/%d, got %s/%d", rec.ID, got.RecognitionStatus, got.RecognitionID)
	}
	if got.GrantStatus != string(model.GrantStatusDraft) || got.GrantID != grant.ID {
		t.Fatalf("grant progress want draft/%d, got %s/%d", grant.ID, got.GrantStatus, got.GrantID)
	}
	if got.IDCard == idCardA {
		t.Fatalf("advisor should see masked id card, got full %s", got.IDCard)
	}

	w = doJSON(t, r, http.MethodGet, fmt.Sprintf("/api/v1/students?keyword=%s", noB), advisorToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("advisor list other class status %d", w.Code)
	}
	if decodeStudentPage(t, w.Body.Bytes()).Total != 0 {
		t.Fatal("advisor should not see other class student")
	}

	w = doJSON(t, r, http.MethodGet, fmt.Sprintf("/api/v1/students/%d", idB), advisorToken, nil)
	if w.Code != http.StatusForbidden {
		t.Fatalf("advisor get other class expect 403, got %d, body %s", w.Code, w.Body.String())
	}

	w = doJSON(t, r, http.MethodGet, fmt.Sprintf("/api/v1/students?recognition_status=none&year=%d&class_id=%d", year, classA.ID), advisorToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("advisor list none status %d, body %s", w.Code, w.Body.String())
	}
	nonePage := decodeStudentPage(t, w.Body.Bytes())
	if nonePage.Total != 1 || nonePage.Items[0].StudentNo != noA2 {
		t.Fatalf("none filter should only return unsubmitted classmate, got %+v", nonePage)
	}

	w = doJSON(t, r, http.MethodGet, fmt.Sprintf("/api/v1/students?recognition_status=pending_class&year=%d", year), advisorToken, nil)
	pendingPage := decodeStudentPage(t, w.Body.Bytes())
	if pendingPage.Total != 1 || pendingPage.Items[0].StudentNo != noA {
		t.Fatalf("pending_class filter want %s, got %+v", noA, pendingPage)
	}

	w = doJSON(t, r, http.MethodGet, fmt.Sprintf("/api/v1/students?keyword=%s", noB), deptToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("dept list other class status %d, body %s", w.Code, w.Body.String())
	}
	deptPage := decodeStudentPage(t, w.Body.Bytes())
	if deptPage.Total != 1 || deptPage.Items[0].RecognitionStatus != "" {
		t.Fatalf("dept should see unsubmitted student in same dept, got %+v", deptPage)
	}
}
