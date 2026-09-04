package service

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-pdf/fpdf"
	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

func TestRecognitionPDFFilename(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		stu  *model.Student
		want string
	}{
		{name: "nil student", stu: nil, want: "申请人-困难认定申请表.pdf"},
		{name: "empty name", stu: &model.Student{Name: "  "}, want: "申请人-困难认定申请表.pdf"},
		{name: "applicant name", stu: &model.Student{Name: "王某某"}, want: "王某某-困难认定申请表.pdf"},
		{name: "strip path chars", stu: &model.Student{Name: "王/某\\某"}, want: "王_某_某-困难认定申请表.pdf"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := recognitionPDFFilename(tc.stu); got != tc.want {
				t.Fatalf("got %q, want %q", got, tc.want)
			}
		})
	}
}

func TestRenderOfficialRecognitionPDF(t *testing.T) {
	t.Parallel()
	root := findBackendRootForDocxTest(t)
	fontPath := filepath.Join(root, "assets", "fonts", "NotoSansSC-Regular.ttf")
	if _, err := os.Stat(fontPath); err != nil {
		t.Skipf("找不到中文字体，跳过: %v", err)
	}

	fontBytes, err := os.ReadFile(fontPath)
	if err != nil {
		t.Skipf("读取中文字体失败，跳过: %v", err)
	}

	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.AddUTF8FontFromBytes("zh", "", fontBytes)
	if pdf.Err() {
		t.Fatalf("加载字体失败: %v", pdf.Error())
	}
	pdf.SetMargins(pdfMarginL, 12, pdfMarginL)
	pdf.AddPage()

	cfg := &config.Config{}
	cfg.Export.SchoolName = "黔西南民族职业技术学院"
	stu := &model.Student{Name: "王某某", Gender: "female"}
	app := &model.RecognitionApplication{
		FamilyPopulation:      3,
		Phone:                 "13800000000",
		Address:               "贵州省兴义市测试路1号",
		PostalCode:            "562400",
		GuardianPhone:         "13900000000",
		IDCard:                "522301200501010011",
		NativePlace:           "贵州兴义",
		PerCapitaAnnualIncome: 8000,
		SpecialTypes:          "low_income",
		FamilyMembers: []model.FamilyMember{
			{Name: "王父", Age: 48, Relation: "father", WorkUnit: "务工", AnnualIncome: 24000},
		},
	}
	labels := labelMaps{maps: map[string]map[string]string{
		"relation": {"father": "父亲"},
	}}
	renderOfficialRecognitionForm(pdf, "zh", cfg, app, stu, "护理系", "护理", "2023级", "1班", labels, nil)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		t.Fatalf("输出 PDF 失败: %v", err)
	}
	if !strings.HasPrefix(buf.String(), "%PDF") {
		t.Fatalf("不是合法 PDF，前缀=%q", buf.String()[:min(8, buf.Len())])
	}
	if buf.Len() < 1000 {
		t.Fatalf("PDF 过小: %d bytes", buf.Len())
	}
}
