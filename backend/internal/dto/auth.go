package dto

import "github.com/wangyifeng2025/student-aid-system/internal/model"

// LoginRequest 登录请求。
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// RefreshRequest 刷新令牌请求。
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// ChangePasswordRequest 修改密码（需登录）。
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required"`
}

// RecoverPasswordRequest 找回密码（公开，校验用户名+手机号）。
type RecoverPasswordRequest struct {
	Username    string `json:"username" binding:"required"`
	Phone       string `json:"phone" binding:"required"`
	NewPassword string `json:"new_password" binding:"required"`
}

// AdminResetPasswordRequest 管理员重置用户密码。
type AdminResetPasswordRequest struct {
	UserID      uint   `json:"user_id" binding:"required"`
	NewPassword string `json:"new_password" binding:"required"`
}

// TokenResponse 令牌响应。
type TokenResponse struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresIn    int       `json:"expires_in"`
	User         UserBrief `json:"user"`
}

// UserBrief 用户简要信息。
type UserBrief struct {
	ID       uint       `json:"id"`
	Username string     `json:"username"`
	RealName string     `json:"real_name"`
	Role     model.Role `json:"role"`
	DeptID   *uint      `json:"dept_id,omitempty"`
	ClassID  *uint      `json:"class_id,omitempty"`
	Phone    string     `json:"phone,omitempty"`
}

// MeResponse 当前用户详情。
type MeResponse struct {
	UserBrief   UserBrief `json:"user"`
	DataScope   string    `json:"data_scope"`
	Permissions []string  `json:"permissions"`
}

// ToUserBrief 从 model.User 转换。
func ToUserBrief(u *model.User) UserBrief {
	return UserBrief{
		ID:       u.ID,
		Username: u.Username,
		RealName: u.RealName,
		Role:     u.Role,
		DeptID:   u.DeptID,
		ClassID:  u.ClassID,
		Phone:    u.Phone,
	}
}
