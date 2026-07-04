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
