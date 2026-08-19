package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

func TestRegionCodeCRUDLookupAndDeleteGuard(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	token := loginToken(t, r, admin.Username, "pass123")

	// 保证测试码以 99 开头，避免与国标冲突
	provCode := fmt.Sprintf("99%02d00000000", time.Now().UnixNano()%90+10)
	cityCode := provCode[:4] + "01000000"
	distCode := provCode[:4] + "01001000"

	t.Cleanup(func() {
		db.Unscoped().Where("code IN ?", []string{distCode, cityCode, provCode}).Delete(&model.RegionCode{})
	})

	w := doJSON(t, r, http.MethodPost, "/api/v1/region-codes", token, dto.RegionCodeRequest{
		Code: provCode, Name: "测试省", Level: 1, Type: "省",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("create province status %d body %s", w.Code, w.Body.String())
	}

	w = doJSON(t, r, http.MethodPost, "/api/v1/region-codes", token, dto.RegionCodeRequest{
		Code: provCode, Name: "测试省2", Level: 1, Type: "省",
	})
	if w.Code != http.StatusConflict {
		t.Fatalf("duplicate expect 409, got %d", w.Code)
	}

	w = doJSON(t, r, http.MethodPost, "/api/v1/region-codes", token, dto.RegionCodeRequest{
		Code: cityCode, Name: "测试市", Level: 2, Type: "地级市", ParentCode: provCode,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("create city status %d body %s", w.Code, w.Body.String())
	}
	w = doJSON(t, r, http.MethodPost, "/api/v1/region-codes", token, dto.RegionCodeRequest{
		Code: distCode, Name: "测试区", Level: 3, Type: "市辖区", ParentCode: cityCode,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("create district status %d body %s", w.Code, w.Body.String())
	}

	w = doJSON(t, r, http.MethodGet, "/api/v1/region-codes?parent_code=", token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list roots status %d", w.Code)
	}

	w = doJSON(t, r, http.MethodGet, "/api/v1/region-codes/lookup?q="+distCode[:6]+"200001010011", token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("lookup status %d body %s", w.Code, w.Body.String())
	}
	var look struct {
		Data dto.RegionLookupResponse `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &look)
	if look.Data.FullName != "测试省测试市测试区" || look.Data.District == nil || look.Data.District.Name != "测试区" {
		t.Fatalf("lookup unexpected: %+v", look.Data)
	}

	w = doJSON(t, r, http.MethodDelete, "/api/v1/region-codes/"+provCode, token, nil)
	if w.Code != http.StatusConflict {
		t.Fatalf("delete province with children expect 409, got %d body %s", w.Code, w.Body.String())
	}

	w = doJSON(t, r, http.MethodDelete, "/api/v1/region-codes/"+distCode, token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete district status %d", w.Code)
	}
	w = doJSON(t, r, http.MethodDelete, "/api/v1/region-codes/"+cityCode, token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete city status %d", w.Code)
	}
	w = doJSON(t, r, http.MethodDelete, "/api/v1/region-codes/"+provCode, token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete province status %d", w.Code)
	}
}

func TestRegionCodeImportAndStudentForbidden(t *testing.T) {
	r, db := setupOrgDictRouter(t)
	admin := seedUser(t, db, "pass123", model.RoleAdmin)
	adminToken := loginToken(t, r, admin.Username, "pass123")
	student := seedUser(t, db, "pass123", model.RoleStudent)
	stuToken := loginToken(t, r, student.Username, "pass123")

	tree := map[string]any{
		"data": map[string]any{
			"code": "00", "name": nil, "level": 0, "children": []any{
				map[string]any{
					"code": "980000000000", "name": "导入省", "level": 1, "type": "省",
					"children": []any{
						map[string]any{"code": "980100000000", "name": "导入市", "level": 2, "type": "地级市", "children": []any{}},
					},
				},
			},
		},
	}
	t.Cleanup(func() {
		db.Unscoped().Where("code LIKE ?", "98%").Delete(&model.RegionCode{})
	})

	w := doJSON(t, r, http.MethodPost, "/api/v1/region-codes/import", adminToken, tree)
	if w.Code != http.StatusOK {
		t.Fatalf("import status %d body %s", w.Code, w.Body.String())
	}

	w = doJSON(t, r, http.MethodGet, "/api/v1/region-codes?keyword=导入省", stuToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("student list expect 200, got %d", w.Code)
	}

	w = doJSON(t, r, http.MethodPost, "/api/v1/region-codes", stuToken, dto.RegionCodeRequest{
		Code: "981000000000", Name: "x", Level: 1, Type: "省",
	})
	if w.Code != http.StatusForbidden {
		t.Fatalf("student create expect 403, got %d", w.Code)
	}
}
