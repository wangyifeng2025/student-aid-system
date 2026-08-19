package service

import (
	"archive/zip"
	"bytes"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFillDocxTemplate(t *testing.T) {
	root := findBackendRootForDocxTest(t)
	templatePath := filepath.Join(root, "assets", "templates", "recognition_application.docx")
	templateBytes, err := os.ReadFile(templatePath)
	if err != nil {
		t.Skipf("找不到认定表 docx 模板，跳过: %v", err)
	}

	repl := map[string]string{
		"school":         "测试学校",
		"student_name":   "张三",
		"gender":         "男",
		"dept":           "护理系",
		"major":          "护理",
		"grade":          "2023级",
		"class":          "1班",
		"birth":          "2005年01月",
		"native_place":   "贵州省",
		"id_card":        "520000",
		"family_pop":     "4人",
		"phone":          "13800000000",
		"address":        "测试地址",
		"postal_code":    "562400",
		"guardian_phone": "13900000000",
		"special_groups": "低保家庭学生：☑是 □否。",
		"per_capita":     "5000",
		"natural":        "无",
		"sudden":         "无",
		"weak_labor":     "无",
		"unemployment":   "无",
		"debt":           "无",
		"other_info":     "无",
		"commitment_text": "本人承诺以上所填写资料真实，如有虚假，愿承担相应责任。",
		"student_signature": "（未签字）",
		// 只填 1 个成员，其余应为空格
		"M1_NAME":      "父亲",
		"M1_AGE":       "50",
		"M1_RELATION":  "父女",
		"M1_WORK":      "家务",
		"M1_OCCUPATION": "无",
		"M1_INCOME":    "0",
		"M1_HEALTH":    "良好",
		"M2_NAME":      " ", "M2_AGE": " ", "M2_RELATION": " ", "M2_WORK": " ",
		"M2_OCCUPATION": " ", "M2_INCOME": " ", "M2_HEALTH": " ",
		"M3_NAME":      " ", "M3_AGE": " ", "M3_RELATION": " ", "M3_WORK": " ",
		"M3_OCCUPATION": " ", "M3_INCOME": " ", "M3_HEALTH": " ",
		"M4_NAME":      " ", "M4_AGE": " ", "M4_RELATION": " ", "M4_WORK": " ",
		"M4_OCCUPATION": " ", "M4_INCOME": " ", "M4_HEALTH": " ",
		"M5_NAME":      " ", "M5_AGE": " ", "M5_RELATION": " ", "M5_WORK": " ",
		"M5_OCCUPATION": " ", "M5_INCOME": " ", "M5_HEALTH": " ",
		"M6_NAME":      " ", "M6_AGE": " ", "M6_RELATION": " ", "M6_WORK": " ",
		"M6_OCCUPATION": " ", "M6_INCOME": " ", "M6_HEALTH": " ",
	}

	out, err := fillDocxTemplate(templateBytes, repl)
	if err != nil {
		t.Fatalf("fill: %v", err)
	}
	if len(out) < 1000 {
		t.Fatalf("output too small: %d", len(out))
	}
	xml := readDocxDocumentXMLForTest(t, out)

	// 固定占位符应全部被替换
	for _, ph := range []string{
		"{student_name}", "{school}", "{special_groups}", "{M1_NAME}", "{M6_HEALTH}",
		"{commitment_text}", "{student_signature}",
	} {
		if strings.Contains(xml, ph) {
			t.Fatalf("占位符 %s 仍残留在 document.xml", ph)
		}
	}
	if !strings.Contains(xml, "张三") {
		t.Fatal("document.xml 中应包含填充的姓名 张三")
	}
	if !strings.Contains(xml, "本人承诺以上所填写资料真实") {
		t.Fatal("document.xml 中应包含承诺正文")
	}
	if !strings.Contains(xml, "父亲") {
		t.Fatal("document.xml 中应包含家庭成员 父亲")
	}
}

func TestFillDocxTemplateWithSignatureImage(t *testing.T) {
	root := findBackendRootForDocxTest(t)
	templatePath := filepath.Join(root, "assets", "templates", "recognition_application.docx")
	templateBytes, err := os.ReadFile(templatePath)
	if err != nil {
		t.Skipf("找不到认定表 docx 模板，跳过: %v", err)
	}

	// 1x1 透明 PNG
	png1x1, err := decodeTestPNG()
	if err != nil {
		t.Fatal(err)
	}

	repl := map[string]string{
		"commitment_text":   "承诺测试",
		"student_signature": "（未签字）",
		"student_name":      "李四",
	}
	out, err := fillDocxTemplateWithImages(templateBytes, repl, []docxImage{{
		Key:      "student_signature",
		Data:     png1x1,
		FileName: "student_signature.png",
	}})
	if err != nil {
		t.Fatalf("fill with image: %v", err)
	}
	xml := readDocxDocumentXMLForTest(t, out)
	if strings.Contains(xml, "{student_signature}") {
		t.Fatal("签字占位符未被替换")
	}
	if strings.Contains(xml, "（未签字）") {
		t.Fatal("有签字图时不应再填「未签字」文本")
	}
	if !strings.Contains(xml, "<w:drawing>") || !strings.Contains(xml, `r:embed="`) {
		t.Fatal("document.xml 中应嵌入 drawing 图片节点")
	}
	if !docxZipHasFile(t, out, "word/media/student_signature.png") {
		t.Fatal("docx 中应包含 word/media/student_signature.png")
	}
}

func decodeTestPNG() ([]byte, error) {
	// 最小合法 1×1 PNG
	return []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
		0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
		0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
		0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
		0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
	}, nil
}

func docxZipHasFile(t *testing.T, docxBytes []byte, name string) bool {
	t.Helper()
	zr, err := zip.NewReader(bytes.NewReader(docxBytes), int64(len(docxBytes)))
	if err != nil {
		t.Fatalf("zip: %v", err)
	}
	for _, f := range zr.File {
		if f.Name == name {
			return true
		}
	}
	return false
}

func TestNormalizeDocxTextRuns(t *testing.T) {
	// 模拟 Word 把 {M2_NAME} 拆成两个 <w:t>
	xml := `<w:p><w:r><w:t>{M2_NA</w:t></w:r><w:r><w:t>ME}</w:t></w:r></w:p>`
	got := normalizeDocxTextRuns(xml)
	if !strings.Contains(got, "{M2_NAME}") {
		t.Fatalf("占位符未合并: %s", got)
	}
}

func TestNormalizeDocxTextRunsNoChange(t *testing.T) {
	xml := `<w:p><w:r><w:t>普通文本</w:t></w:r></w:p>`
	got := normalizeDocxTextRuns(xml)
	if got != xml {
		t.Fatalf("无占位符段落不应被修改: got %s", got)
	}
}

func readDocxDocumentXMLForTest(t *testing.T, docxBytes []byte) string {
	t.Helper()
	zr, err := zip.NewReader(bytes.NewReader(docxBytes), int64(len(docxBytes)))
	if err != nil {
		t.Fatalf("zip reader: %v", err)
	}
	for _, f := range zr.File {
		if f.Name != docxDocumentXML {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			t.Fatalf("open document.xml: %v", err)
		}
		data, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			t.Fatalf("read document.xml: %v", err)
		}
		return string(data)
	}
	t.Fatal("document.xml not found")
	return ""
}

func findBackendRootForDocxTest(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("go.mod not found")
		}
		dir = parent
	}
}
