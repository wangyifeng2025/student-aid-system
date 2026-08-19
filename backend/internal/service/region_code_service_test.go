package service

import (
	"testing"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/regiondata"
)

func TestParseRegionTreeDefault(t *testing.T) {
	items, skipped := parseRegionTree(regiondata.DefaultJSON)
	if skipped < 1 {
		t.Fatalf("无区划代码的节点（如海外）应被跳过，got skipped=%d", skipped)
	}
	if len(items) < 3000 {
		t.Fatalf("内置区划过少: %d", len(items))
	}
	byCode := map[string]model.RegionCode{}
	for i := range items {
		byCode[items[i].Code] = items[i]
	}
	if byCode["110000000000"].Name != "北京市" {
		t.Fatalf("缺北京市: %+v", byCode["110000000000"])
	}
	if byCode["110101000000"].Name != "东城区" {
		t.Fatalf("缺东城区")
	}
	if byCode["520000000000"].Name != "贵州省" {
		t.Fatalf("缺贵州省")
	}
	xingyi, ok := byCode["522301000000"]
	if !ok || xingyi.Name != "兴义市" {
		t.Fatalf("缺兴义市: %+v", xingyi)
	}
	if xingyi.Level != 3 || xingyi.ParentCode != "522300000000" {
		t.Fatalf("兴义市级别/上级不正确: %+v", xingyi)
	}
	if _, ok := byCode["资料暂缺"]; ok {
		t.Fatal("不应导入无效区划代码")
	}
}

func TestParseRegionTreeSixDigitArray(t *testing.T) {
	raw := []byte(`[
		{"code":"520000","name":"贵州省","children":[
			{"code":"522300","name":"黔西南布依族苗族自治州","children":[
				{"code":"522301","name":"兴义市"}
			]}
		]}
	]`)
	items, skipped := parseRegionTree(raw)
	if skipped != 0 || len(items) != 3 {
		t.Fatalf("got items=%d skipped=%d", len(items), skipped)
	}
	if items[2].Code != "522301000000" || items[2].Name != "兴义市" || items[2].Level != 3 {
		t.Fatalf("兴义市未正确导入: %+v", items[2])
	}
	if items[2].ParentCode != "522300000000" {
		t.Fatalf("兴义市上级应为黔西南: %s", items[2].ParentCode)
	}
}

func TestParseRegionTreeWrappedAndSkipInvalid(t *testing.T) {
	raw := []byte(`{"data":{"code":"00","name":null,"level":0,"children":[
		{"code":"990000000000","name":"测试省","level":1,"type":"省","children":[
			{"code":"990100000000","name":"测试市","level":2,"type":"地级市","children":[]}
		]},
		{"code":"资料暂缺","name":"无效","level":1,"type":"省","children":null}
	]}}`)
	items, skipped := parseRegionTree(raw)
	if skipped != 1 || len(items) != 2 {
		t.Fatalf("got items=%d skipped=%d", len(items), skipped)
	}
	if items[0].Code != "990000000000" || items[1].ParentCode != "990000000000" {
		t.Fatalf("parent link unexpected: %+v", items)
	}
}

func TestExtractIDPrefix(t *testing.T) {
	if got := extractIDPrefix("110101200601010014"); got != "110101" {
		t.Fatalf("id card prefix: %s", got)
	}
	if got := extractIDPrefix("110101"); got != "110101" {
		t.Fatalf("6-digit: %s", got)
	}
	if got := extractIDPrefix("52"); got != "520000" {
		t.Fatalf("2-digit: %s", got)
	}
}

func TestNormalizeRegionCode(t *testing.T) {
	got, err := normalizeRegionCode("110101")
	if err != nil || got != "110101000000" {
		t.Fatalf("pad 6-digit: %s %v", got, err)
	}
	if _, err := normalizeRegionCode("资料暂缺"); err == nil {
		t.Fatal("invalid code should fail")
	}
}
