package service

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/go-pdf/fpdf"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

func TestGrantPDFFilename(t *testing.T) {
	t.Parallel()
	if got := grantPDFFilename(&model.Student{Name: "王某某"}); got != "王某某-国家助学金申请表.pdf" {
		t.Fatalf("got %q", got)
	}
	if got := grantPDFFilename(nil); got != "申请人-国家助学金申请表.pdf" {
		t.Fatalf("nil: %q", got)
	}
}

func TestBuildGrantFormDataIncludesFamily(t *testing.T) {
	t.Parallel()
	app := &model.GrantApplication{
		Phone: "13800000000", HouseholdType: model.HouseholdRural,
		FamilyPopulation: 3, MonthlyIncome: 2000, PerCapitaMonthlyIncome: 500,
		IncomeSource: "wage", Address: "测试地址", PostalCode: "562400",
		Reason: "家庭经济困难。",
		FamilyMembers: []model.GrantFamilyMember{
			{Name: "王父", Age: 48, Relation: "father", WorkUnit: "务农"},
			{Name: "王母", Age: 46, Relation: "mother", WorkUnit: "务工"},
		},
	}
	labels := labelMaps{maps: map[string]map[string]string{
		"relation":      {"father": "父亲", "mother": "母亲"},
		"income_source": {"wage": "务工"},
	}}
	d := buildGrantFormData(app, &model.Student{Name: "王某某", Gender: "male", StudentNo: "2023001"}, "护理系1班", "2023级", labels)
	if d.Members[0].Name != "王父" || d.Members[0].Age != "48" || d.Members[0].Relation != "父亲" || d.Members[0].Work != "务农" {
		t.Fatalf("member0: %+v", d.Members[0])
	}
	if d.Members[1].Name != "王母" {
		t.Fatalf("member1: %+v", d.Members[1])
	}
	if d.Members[2].Name != "" {
		t.Fatalf("empty row should stay blank: %+v", d.Members[2])
	}
	if d.Household != "□城镇      ■农村" {
		t.Fatalf("household %q", d.Household)
	}
}

func TestRenderOfficialGrantPDF(t *testing.T) {
	t.Parallel()
	root := findBackendRootForDocxTest(t)
	fontBytes, err := os.ReadFile(filepath.Join(root, "assets", "fonts", "NotoSansSC-Regular.ttf"))
	if err != nil {
		t.Skipf("找不到中文字体: %v", err)
	}
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.AddUTF8FontFromBytes("zh", "", fontBytes)
	pdf.SetMargins(grantPdfMarginL, grantPdfMarginT, grantPdfMarginL)
	pdf.SetAutoPageBreak(false, grantPdfMarginB)
	pdf.AddPage()
	renderOfficialGrantForm(pdf, "zh", grantFormData{
		StudentName: "王某某", Gender: "男", StudentNo: "2023001", Grade: "2023级",
		SchoolUnit: "黔西南民族职业技术学院护理系2023级护理专业1班",
		Household:  "□城镇      ■农村", FamilyPop: "3人",
		Reason: "家庭经济困难，申请国家助学金。",
		Members: []grantMemberLine{
			{Name: "王父", Age: "48", Relation: "父亲", Work: "务农"},
			{}, {}, {}, {}, {}, {}, {}, {},
		},
		DeptOpinion: "同意", CollegeOpinion: "同意",
	})
	if pdf.Err() {
		t.Fatal(pdf.Error())
	}
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		t.Fatal(err)
	}
	if !bytes.HasPrefix(buf.Bytes(), []byte("%PDF")) || buf.Len() < 1000 {
		t.Fatalf("pdf too small or invalid: %d", buf.Len())
	}
}
