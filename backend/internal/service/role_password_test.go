package service

import (
	"testing"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

func TestRoleInitialPassword(t *testing.T) {
	t.Parallel()

	cases := []struct {
		role    model.Role
		phone   string
		want    string
		wantErr bool
	}{
		{model.RoleClassAdvisor, "13800001234", "Adv001234", false},
		{model.RoleClassAdvisor, "138-0000-1234", "Adv001234", false},
		{model.RoleClassAdvisor, "123", "Adv123456", false},
		{model.RoleDepartment, "13900005678", "Dept005678", false},
		{model.RoleDepartment, "5678", "", true},
		{model.RoleAidCenter, "13611119876", "Aid119876", false},
		{model.RoleAidCenter, "", "", true},
		{model.RoleAdmin, "13800001234", "", true},
	}
	for _, tc := range cases {
		got, err := roleInitialPassword(tc.role, tc.phone)
		if tc.wantErr {
			if err == nil {
				t.Errorf("%s / %q 应报错，实际得到 %q", tc.role, tc.phone, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("%s / %q 不应报错: %v", tc.role, tc.phone, err)
			continue
		}
		if got != tc.want {
			t.Errorf("%s / %q = %q, want %q", tc.role, tc.phone, got, tc.want)
		}
	}
}

func TestInitialImportUserPassword(t *testing.T) {
	t.Parallel()

	got, err := initialImportUserPassword(model.RoleDepartment, "dept01", "13800001234")
	if err != nil || got != "Dept001234" {
		t.Fatalf("系管理员导入密码 = %q, %v; want Dept001234", got, err)
	}
	got, err = initialImportUserPassword(model.RoleAidCenter, "aid01", "13900005678")
	if err != nil || got != "Aid005678" {
		t.Fatalf("学院管理员导入密码 = %q, %v; want Aid005678", got, err)
	}
	got, err = initialImportUserPassword(model.RoleClassAdvisor, "T2024001", "13700001111")
	if err != nil || got != "Adv001111" {
		t.Fatalf("班主任导入密码 = %q, %v; want Adv001111", got, err)
	}
	got, err = initialImportUserPassword(model.RoleAdmin, "admin01", "13800001234")
	if err != nil || got != "Udmin01" {
		t.Fatalf("系统管理员导入密码 = %q, %v; want Udmin01", got, err)
	}
	if _, err := initialImportUserPassword(model.RoleDepartment, "dept01", ""); err == nil {
		t.Fatal("系管理员无手机号导入应失败")
	}
}
