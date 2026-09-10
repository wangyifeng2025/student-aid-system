package service

import (
	"bytes"
	"encoding/base64"
	"strings"
	"testing"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/xuri/excelize/v2"
)

func TestAttachImportErrorFile(t *testing.T) {
	sess := newImportSession([]string{"学号", "姓名"}, "学生导入失败.xlsx")
	sess.fail(3, "学号", "学号不能为空", []string{"", "缺学号"})
	out := sess.done()
	if out.Failed != 1 {
		t.Fatalf("failed want 1, got %d", out.Failed)
	}
	if out.ErrorFileName != "学生导入失败.xlsx" {
		t.Fatalf("filename: %s", out.ErrorFileName)
	}
	if out.ErrorFile == "" {
		t.Fatal("expected error_file")
	}
	raw, err := base64.StdEncoding.DecodeString(out.ErrorFile)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	f, err := excelize.OpenReader(bytes.NewReader(raw))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer f.Close()
	rows, err := f.GetRows("Sheet1")
	if err != nil {
		t.Fatalf("rows: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("want header+1 data row, got %d: %+v", len(rows), rows)
	}
	if got := strings.Join(rows[0], ","); got != "学号,姓名,错误原因" {
		t.Fatalf("header: %s", got)
	}
	if rows[1][0] != "" || rows[1][1] != "缺学号" {
		t.Fatalf("data row: %+v", rows[1])
	}
	if !strings.Contains(rows[1][2], "学号不能为空") {
		t.Fatalf("reason: %s", rows[1][2])
	}
}

func TestAttachImportErrorFileSkipsHeaderOnly(t *testing.T) {
	result := newImportResult()
	result.Fail(dto.ImportRowError{Row: 1, Column: "表头", Message: "文件为空"})
	attachImportErrorFile(result, studentColumns, "学生导入失败.xlsx")
	if result.ErrorFile != "" {
		t.Fatal("header-only errors should not produce a download file")
	}
}

func TestCheckImportHeaderAllowsTrailingErrorColumn(t *testing.T) {
	header := append(append([]string{}, studentColumns...), importErrorReasonColumn)
	result := newImportResult()
	if err := checkImportHeader([][]string{header}, studentColumns, result); err != nil {
		t.Fatalf("trailing 错误原因 column should be accepted: %v", err)
	}
}
