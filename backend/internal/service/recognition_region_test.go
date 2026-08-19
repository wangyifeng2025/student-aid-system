package service

import (
	"testing"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
)

func TestMergeIDCardRegion(t *testing.T) {
	t.Parallel()

	t.Run("fills native place and prepends region to street detail", func(t *testing.T) {
		req := &dto.RecognitionRequest{
			NativePlace: "旧籍贯",
			Address:     "幸福路1号",
		}
		mergeIDCardRegion(req, "贵州省黔西南布依族苗族自治州兴义市")
		if req.NativePlace != "贵州省黔西南布依族苗族自治州兴义市" {
			t.Fatalf("native_place = %q", req.NativePlace)
		}
		if req.Address != "贵州省黔西南布依族苗族自治州兴义市幸福路1号" {
			t.Fatalf("address = %q", req.Address)
		}
	})

	t.Run("does not duplicate region prefix", func(t *testing.T) {
		req := &dto.RecognitionRequest{
			Address: "贵州省黔西南布依族苗族自治州兴义市幸福路1号",
		}
		mergeIDCardRegion(req, "贵州省黔西南布依族苗族自治州兴义市")
		if req.Address != "贵州省黔西南布依族苗族自治州兴义市幸福路1号" {
			t.Fatalf("address = %q", req.Address)
		}
	})

	t.Run("empty region leaves request unchanged", func(t *testing.T) {
		req := &dto.RecognitionRequest{NativePlace: "手填", Address: "手填地址"}
		mergeIDCardRegion(req, "  ")
		if req.NativePlace != "手填" || req.Address != "手填地址" {
			t.Fatalf("got native=%q address=%q", req.NativePlace, req.Address)
		}
	})
}

func TestAddressDetailBeyondRegion(t *testing.T) {
	t.Parallel()
	region := "北京市东城区"
	if got := addressDetailBeyondRegion(region+"某胡同3号", region); got != "某胡同3号" {
		t.Fatalf("got %q", got)
	}
	if got := addressDetailBeyondRegion(region, region); got != "" {
		t.Fatalf("expected empty detail, got %q", got)
	}
	if got := addressDetailBeyondRegion("某胡同3号", region); got != "某胡同3号" {
		t.Fatalf("got %q", got)
	}
}
