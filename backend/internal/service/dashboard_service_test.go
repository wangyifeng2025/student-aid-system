package service

import (
	"testing"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
)

func TestDashboardScopeLabel(t *testing.T) {
	t.Parallel()
	cases := []struct {
		scope rbac.DataScope
		want  string
	}{
		{rbac.ScopeSelf, "仅本人"},
		{rbac.ScopeClass, "本班级"},
		{rbac.ScopeDepartment, "本教学系"},
		{rbac.ScopeSchool, "全校"},
	}
	for _, tt := range cases {
		if got := dashboardScopeLabel(tt.scope); got != tt.want {
			t.Errorf("dashboardScopeLabel(%s) = %s, want %s", tt.scope, got, tt.want)
		}
	}
}

func TestDashboardReviewHint(t *testing.T) {
	t.Parallel()
	if got := dashboardReviewHint(model.RoleClassAdvisor); got != "班级评审待办" {
		t.Fatalf("got %s", got)
	}
	if got := dashboardReviewHint(model.RoleAdmin); got != "各级待审" {
		t.Fatalf("got %s", got)
	}
}

func TestMergeDashboardItemsLimit(t *testing.T) {
	t.Parallel()
	a := []dto.DashboardItem{{ID: 1, Kind: "recognition"}, {ID: 2, Kind: "recognition"}}
	b := []dto.DashboardItem{{ID: 3, Kind: "grant"}, {ID: 4, Kind: "grant"}}
	got := mergeDashboardItems(a, b, 3)
	if len(got) != 3 {
		t.Fatalf("len = %d", len(got))
	}
	if got[2].Kind != "grant" {
		t.Fatalf("third item kind = %s", got[2].Kind)
	}
}
