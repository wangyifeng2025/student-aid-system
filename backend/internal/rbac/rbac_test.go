package rbac

import (
	"testing"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

func TestDataScopeForRole(t *testing.T) {
	tests := []struct {
		role model.Role
		want DataScope
	}{
		{model.RoleStudent, ScopeSelf},
		{model.RoleClassAdvisor, ScopeClass},
		{model.RoleDepartment, ScopeDepartment},
		{model.RoleAidCenter, ScopeSchool},
		{model.RoleAdmin, ScopeSchool},
	}
	for _, tt := range tests {
		if got := DataScopeForRole(tt.role); got != tt.want {
			t.Errorf("DataScopeForRole(%s) = %s, want %s", tt.role, got, tt.want)
		}
	}
}

func TestActorCanAccessStudent(t *testing.T) {
	deptID := uint(10)
	classID := uint(20)

	student := Actor{UserID: 1, Role: model.RoleStudent}
	if !student.CanAccessStudent(1, 20, 10) {
		t.Error("学生应能访问本人")
	}
	if student.CanAccessStudent(2, 20, 10) {
		t.Error("学生不应访问他人")
	}

	advisor := Actor{UserID: 2, Role: model.RoleClassAdvisor, ClassID: &classID}
	if !advisor.CanAccessStudent(99, 20, 10) {
		t.Error("班主任应能访问本班学生")
	}
	if advisor.CanAccessStudent(99, 21, 10) {
		t.Error("班主任不应访问其他班学生")
	}

	deptUser := Actor{UserID: 3, Role: model.RoleDepartment, DeptID: &deptID}
	if !deptUser.CanAccessStudent(99, 99, 10) {
		t.Error("系经办人应能访问本系")
	}
	if deptUser.CanAccessStudent(99, 99, 11) {
		t.Error("系经办人不应访问其他系")
	}

	admin := Actor{UserID: 4, Role: model.RoleAdmin}
	if !admin.CanAccessStudent(99, 99, 99) {
		t.Error("管理员应能访问全校")
	}
}
