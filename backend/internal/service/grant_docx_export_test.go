package service

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

func TestFillGrantDocxTemplate(t *testing.T) {
	root := findBackendRootForDocxTest(t)
	templatePath := filepath.Join(root, "assets", "templates", "grant_national_aid.docx")
	templateBytes, err := os.ReadFile(templatePath)
	if err != nil {
		t.Skipf("找不到助学金 docx 模板，跳过: %v", err)
	}

	repl := map[string]string{
		"student_name":      "张三",
		"gender":            "男",
		"birth":             "2005.01",
		"nation":            "汉族",
		"political_status":  "共青团员",
		"enroll_time":       "2023.09",
		"student_no":        "20230001",
		"grade":             "2023级",
		"id_card":           "520000200501010011",
		"phone":             "13800000000",
		"school_unit":       "黔西南民族职业技术学院护理系2023级护理专业1班",
		"household":         "☑城镇      □农村",
		"family_pop":        "4人",
		"monthly_income":    "2000元",
		"per_capita_income": "500元",
		"income_source":     "务工",
		"address":           "测试地址",
		"postal_code":       "562400",
		"reason":            "家庭经济困难，申请国家助学金。",
		"dept_opinion":      "同意",
		"college_opinion":   "同意",
		"M1_NAME": "父亲", "M1_AGE": "50", "M1_RELATION": "父子", "M1_WORK": "务农",
		"M2_NAME": " ", "M2_AGE": " ", "M2_RELATION": " ", "M2_WORK": " ",
		"M3_NAME": " ", "M3_AGE": " ", "M3_RELATION": " ", "M3_WORK": " ",
		"M4_NAME": " ", "M4_AGE": " ", "M4_RELATION": " ", "M4_WORK": " ",
		"M5_NAME": " ", "M5_AGE": " ", "M5_RELATION": " ", "M5_WORK": " ",
		"M6_NAME": " ", "M6_AGE": " ", "M6_RELATION": " ", "M6_WORK": " ",
		"M7_NAME": " ", "M7_AGE": " ", "M7_RELATION": " ", "M7_WORK": " ",
		"M8_NAME": " ", "M8_AGE": " ", "M8_RELATION": " ", "M8_WORK": " ",
		"M9_NAME": " ", "M9_AGE": " ", "M9_RELATION": " ", "M9_WORK": " ",
	}

	out, err := fillDocxTemplate(templateBytes, repl)
	if err != nil {
		t.Fatalf("fill: %v", err)
	}
	if len(out) < 1000 {
		t.Fatalf("output too small: %d", len(out))
	}
	xml := readDocxDocumentXMLForTest(t, out)

	for _, ph := range []string{"{student_name}", "{school_unit}", "{reason}", "{M1_NAME}", "{M9_WORK}"} {
		if strings.Contains(xml, ph) {
			t.Fatalf("占位符 %s 仍残留在 document.xml", ph)
		}
	}
	if !strings.Contains(xml, "张三") {
		t.Fatal("document.xml 中应包含填充的姓名 张三")
	}
	if !strings.Contains(xml, "家庭经济困难，申请国家助学金。") {
		t.Fatal("document.xml 中应包含申请理由")
	}
}

func TestGrantHouseholdCheckbox(t *testing.T) {
	if got := grantHouseholdCheckbox(model.HouseholdUrban); got != "☑城镇      □农村" {
		t.Fatalf("urban: %q", got)
	}
	if got := grantHouseholdCheckbox(model.HouseholdRural); got != "□城镇      ☑农村" {
		t.Fatalf("rural: %q", got)
	}
}

func TestGrantSchoolUnitText(t *testing.T) {
	cfg := &config.Config{}
	cfg.Export.SchoolName = "黔西南民族职业技术学院"
	got := grantSchoolUnitText(cfg, "医药系2021级护理专业1班")
	want := "黔西南民族职业技术学院医药系2021级护理专业1班"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}
