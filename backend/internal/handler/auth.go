package handler

import (
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/middleware"
	"github.com/wangyifeng2025/student-aid-system/internal/service"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

// Login 账号密码登录，签发 access + refresh 双令牌。
func (h *Handler) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	result, err := h.Auth.Login(&req)
	if err != nil {
		mapAuthError(c, err)
		return
	}
	response.OK(c, result)
}

// Refresh 使用 refresh_token 刷新双令牌。
func (h *Handler) Refresh(c *gin.Context) {
	var req dto.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	result, err := h.Auth.Refresh(req.RefreshToken)
	if err != nil {
		mapAuthError(c, err)
		return
	}
	response.OK(c, result)
}

// Me 返回当前登录用户、数据范围与权限列表。
func (h *Handler) Me(c *gin.Context) {
	result, err := h.Auth.GetMe(middleware.CurrentUserID(c))
	if err != nil {
		mapAuthError(c, err)
		return
	}
	response.OK(c, result)
}

// ChangePassword 修改密码（需原密码）。
func (h *Handler) ChangePassword(c *gin.Context) {
	var req dto.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	if err := h.Auth.ChangePassword(middleware.CurrentUserID(c), &req); err != nil {
		mapAuthError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "密码修改成功"})
}

// RecoverPassword 找回密码（用户名 + 手机号校验）。
func (h *Handler) RecoverPassword(c *gin.Context) {
	var req dto.RecoverPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	if err := h.Auth.RecoverPassword(&req); err != nil {
		mapAuthError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "密码已重置，请使用新密码登录"})
}

// AdminResetPassword 管理员重置用户密码。
func (h *Handler) AdminResetPassword(c *gin.Context) {
	user, ok := middleware.CurrentUser(c)
	if !ok {
		response.Unauthorized(c, "未认证")
		return
	}

	var req dto.AdminResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	if err := h.Auth.AdminResetPassword(user, &req); err != nil {
		mapAuthError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "用户密码已重置"})
}

func mapAuthError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrInvalidCredentials):
		response.Unauthorized(c, err.Error())
	case errors.Is(err, service.ErrInvalidToken):
		response.Unauthorized(c, err.Error())
	case errors.Is(err, service.ErrInvalidPassword):
		response.BadRequest(c, err.Error())
	case errors.Is(err, service.ErrPhoneMismatch):
		response.BadRequest(c, err.Error())
	case errors.Is(err, service.ErrAccountDisabled):
		response.Forbidden(c, err.Error())
	case errors.Is(err, service.ErrForbidden):
		response.Forbidden(c, err.Error())
	default:
		// password.Validate 等业务校验错误直接返回文案
		response.BadRequest(c, err.Error())
	}
}
