package service

import (
	"bytes"
	"strings"
	"testing"

	"github.com/xuri/excelize/v2"
)

func TestFillRecognitionSummaryXLSX(t *testing.T) {
	root := findBackendRootForDocxTest(t)
	path := recognitionSummaryTemplatePath(nil)
	if !strings.Contains(path, "recognition_result_summary.xlsx") {
		t.Fatalf("unexpected default template path: %s", path)
	}
	path = root + "/assets/templates/recognition_result_summary.xlsx"

	meta := recognitionSummaryMeta{
		School:   "测试学校",
		Year:     2026,
		DeptName: "护理系",
		Leader:   "李老师",
	}
	rows := []recognitionSummaryRow{
		{
			DeptName:   "护理系",
			Name:       "张三",
			Gender:     "男",
			Nation:     "汉族",
			Grade:      "2024级",
			ClassName:  "护理2401班",
			IDCard:     "520000200501010011",
			Address:    "兴义市某路1号",
			Phone:      "13800001111",
			Difficulty: "特别困难",
			Basis:      "脱贫家庭学生、孤儿",
		},
		{
			DeptName:   "护理系",
			Name:       "李四",
			Gender:     "女",
			Nation:     "苗族",
			Grade:      "2024级",
			ClassName:  "护理2401班",
			IDCard:     "520000200601010022",
			Address:    "兴义市某路2号",
			Phone:      "13800002222",
			Difficulty: "一般困难",
			Basis:      "一般家庭经济困难",
		},
	}

	data, err := fillRecognitionSummaryXLSX(path, meta, rows)
	if err != nil {
		t.Fatalf("fill: %v", err)
	}
	if len(data) < 1000 {
		t.Fatalf("output too small: %d", len(data))
	}

	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("open filled xlsx: %v", err)
	}
	defer f.Close()

	title, err := f.GetCellValue(recognitionSummarySheet, "A1")
	if err != nil {
		t.Fatalf("A1: %v", err)
	}
	if !strings.Contains(title, "测试学校") || !strings.Contains(title, "2026-2027学年") {
		t.Fatalf("title want school+学年, got %q", title)
	}
	dept, _ := f.GetCellValue(recognitionSummarySheet, "D2")
	if dept != "护理系" {
		t.Fatalf("D2 系别 want 护理系, got %q", dept)
	}
	leader, _ := f.GetCellValue(recognitionSummarySheet, "L2")
	if leader != "李老师" {
		t.Fatalf("L2 负责人 want 李老师, got %q", leader)
	}

	gotRows, err := f.GetRows(recognitionSummarySheet)
	if err != nil {
		t.Fatalf("GetRows: %v", err)
	}
	if len(gotRows) < 5 {
		t.Fatalf("expected header + 2 data + note, got %d rows: %#v", len(gotRows), gotRows)
	}
	data1 := gotRows[3]
	if cellAt(data1, 0) != "1" || cellAt(data1, 2) != "张三" || cellAt(data1, 10) != "特别困难" {
		t.Fatalf("row1 unexpected: %#v", data1)
	}
	if cellAt(data1, 11) != "脱贫家庭学生、孤儿" {
		t.Fatalf("basis want 脱贫家庭学生、孤儿, got %q", cellAt(data1, 11))
	}
	data2 := gotRows[4]
	if cellAt(data2, 0) != "2" || cellAt(data2, 2) != "李四" {
		t.Fatalf("row2 unexpected: %#v", data2)
	}
	note := strings.Join(gotRows[len(gotRows)-1], "")
	if !strings.Contains(note, "认定依据包含") {
		t.Fatalf("last row should be note, got %q", note)
	}
}

func TestFillRecognitionSummaryXLSXEmpty(t *testing.T) {
	root := findBackendRootForDocxTest(t)
	path := root + "/assets/templates/recognition_result_summary.xlsx"
	data, err := fillRecognitionSummaryXLSX(path, recognitionSummaryMeta{School: "测试学校"}, nil)
	if err != nil {
		t.Fatalf("fill empty: %v", err)
	}
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer f.Close()
	gotRows, err := f.GetRows(recognitionSummarySheet)
	if err != nil {
		t.Fatalf("GetRows: %v", err)
	}
	if len(gotRows) < 3 {
		t.Fatalf("expected at least title/header, got %d", len(gotRows))
	}
	note := strings.Join(gotRows[len(gotRows)-1], "")
	if !strings.Contains(note, "认定依据包含") {
		t.Fatalf("last row should be note, got %q", note)
	}
}

func TestSummaryBasis(t *testing.T) {
	labels := labelMaps{maps: map[string]map[string]string{
		"special_group_type": {
			"poverty": "脱贫家庭学生",
			"orphan":  "孤儿",
		},
	}}
	if got := summaryBasis("poverty,orphan", labels); got != "脱贫家庭学生、孤儿" {
		t.Fatalf("got %q", got)
	}
	if got := summaryBasis("", labels); got != "一般家庭经济困难" {
		t.Fatalf("empty want 一般家庭经济困难, got %q", got)
	}
}

func cellAt(row []string, idx int) string {
	if idx < len(row) {
		return row[idx]
	}
	return ""
}
