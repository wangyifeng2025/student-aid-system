package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/middleware"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

// ListUsers 分页列出用户（仅管理员）。
func (h *Handler) ListUsers(c *gin.Context) {
	page, pageSize := parsePagination(c)
	f := repository.UserFilter{
		Role:     c.Query("role"),
		Status:   parseIntPtrQuery(c, "status"),
		Keyword:  c.Query("keyword"),
		Page:     page,
		PageSize: pageSize,
	}
	res, err := h.User.List(f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// GetUser 用户详情。
func (h *Handler) GetUser(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.User.Get(id)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// CreateUser 新建用户。
func (h *Handler) CreateUser(c *gin.Context) {
	var req dto.UserCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.User.Create(&req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// UpdateUser 修改用户。
func (h *Handler) UpdateUser(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req dto.UserUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.User.Update(middleware.CurrentUserID(c), id, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// DeleteUser 删除用户。
func (h *Handler) DeleteUser(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.User.Delete(middleware.CurrentUserID(c), id); err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "删除成功"})
}

// ResetUserPassword 管理员重置指定用户密码。
func (h *Handler) ResetUserPassword(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req dto.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	if err := h.User.ResetPassword(id, req.NewPassword); err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "用户密码已重置"})
}
