package rbac

import (
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"gorm.io/gorm"
)

// DataScope 数据访问范围（与角色绑定）。
type DataScope string

const (
	ScopeSelf       DataScope = "self"       // 仅本人
	ScopeClass      DataScope = "class"      // 本班级
	ScopeDepartment DataScope = "department" // 本教学系
	ScopeSchool     DataScope = "school"     // 全校
)

// DataScopeForRole 根据角色返回默认数据范围。
func DataScopeForRole(role model.Role) DataScope {
	switch role {
	case model.RoleStudent:
		return ScopeSelf
	case model.RoleClassAdvisor:
		return ScopeClass
	case model.RoleDepartment:
		return ScopeDepartment
	case model.RoleAidCenter, model.RoleAdmin:
		return ScopeSchool
	default:
		return ScopeSelf
	}
}

// Actor 当前操作者上下文（用于数据范围过滤）。
type Actor struct {
	UserID   uint
	Role     model.Role
	DeptID   *uint
	ClassIDs []uint // 班主任数据范围，来自 advisor_classes；空则不可见任何班级
}

// ManagedClassIDs 班主任数据范围内的班级。
func (a Actor) ManagedClassIDs() []uint {
	return a.ClassIDs
}

// NewActor 从 User 构建 Actor（班主任班级范围须由调用方从名册填入 ClassIDs）。
func NewActor(u *model.User) Actor {
	return Actor{
		UserID: u.ID,
		Role:   u.Role,
		DeptID: u.DeptID,
	}
}

// Scope 返回操作者的数据范围。
func (a Actor) Scope() DataScope {
	return DataScopeForRole(a.Role)
}

// CanAccessStudent 判断操作者是否有权访问目标学生数据（按 user_id / class_id / dept_id）。
func (a Actor) CanAccessStudent(targetUserID uint, targetClassID, targetDeptID uint) bool {
	switch a.Scope() {
	case ScopeSchool:
		return true
	case ScopeDepartment:
		if a.DeptID == nil {
			return false
		}
		return targetDeptID == *a.DeptID
	case ScopeClass:
		for _, id := range a.ManagedClassIDs() {
			if targetClassID == id {
				return true
			}
		}
		return false
	case ScopeSelf:
		return targetUserID == a.UserID
	default:
		return false
	}
}

// ApplyStudentScope 在查询 students 表时按数据范围追加 WHERE 条件。
// 用法：db.Scopes(rbac.ApplyStudentScope(actor)).Find(&students)
func ApplyStudentScope(actor Actor) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		switch actor.Scope() {
		case ScopeSchool:
			return db
		case ScopeDepartment:
			if actor.DeptID != nil {
				return db.Where("students.dept_id = ?", *actor.DeptID)
			}
			return db.Where("1 = 0")
		case ScopeClass:
			ids := actor.ManagedClassIDs()
			if len(ids) == 0 {
				return db.Where("1 = 0")
			}
			return db.Where("students.class_id IN ?", ids)
		case ScopeSelf:
			return db.Where("students.user_id = ?", actor.UserID)
		default:
			return db.Where("1 = 0")
		}
	}
}
