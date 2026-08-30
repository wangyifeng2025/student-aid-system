package dto

import (
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

// ===== 模块 10：用户管理（仅管理员）=====

// UserCreateRequest 创建用户请求。
type UserCreateRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	RealName string `json:"real_name" binding:"required"`
	Role     string `json:"role" binding:"required"`
	Phone    string `json:"phone"`
	DeptID   *uint  `json:"dept_id"`
	Status   *int   `json:"status"` // 1 启用 0 禁用，缺省为启用
}

// UserUpdateRequest 修改用户请求（用户名不可改；改密走专用接口）。
type UserUpdateRequest struct {
	RealName string `json:"real_name" binding:"required"`
	Role     string `json:"role" binding:"required"`
	Phone    string `json:"phone"`
	DeptID   *uint  `json:"dept_id"`
	Status   *int   `json:"status"`
}

// ResetPasswordRequest 管理员重置指定用户密码（RESTful 形式）。
type ResetPasswordRequest struct {
	NewPassword string `json:"new_password" binding:"required"`
}

// UserResponse 用户详情响应（用于管理列表/详情）。
type UserResponse struct {
	ID        uint       `json:"id"`
	Username  string     `json:"username"`
	RealName  string     `json:"real_name"`
	Role      model.Role `json:"role"`
	Phone     string     `json:"phone"`
	DeptID    *uint      `json:"dept_id"`
	ClassIDs  []uint     `json:"class_ids,omitempty"` // 班主任所管班级（只读，来自名册）
	Status    int        `json:"status"`
	CreatedAt time.Time  `json:"created_at"`
}

func ToUserResponse(u *model.User) UserResponse {
	return UserResponse{
		ID:        u.ID,
		Username:  u.Username,
		RealName:  u.RealName,
		Role:      u.Role,
		Phone:     u.Phone,
		DeptID:    u.DeptID,
		Status:    u.Status,
		CreatedAt: u.CreatedAt,
	}
}

func ToUserResponses(items []model.User) []UserResponse {
	out := make([]UserResponse, 0, len(items))
	for i := range items {
		out = append(out, ToUserResponse(&items[i]))
	}
	return out
}
