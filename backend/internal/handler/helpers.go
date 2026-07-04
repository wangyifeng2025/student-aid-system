package handler

import (
	"errors"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/middleware"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/service"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

// currentActor 从上下文取 RBAC Actor；缺失时写出 401 并返回 false。
func currentActor(c *gin.Context) (rbac.Actor, bool) {
	actor, ok := middleware.CurrentActor(c)
	if !ok {
		response.Unauthorized(c, "未认证")
		return rbac.Actor{}, false
	}
	return actor, true
}

// parseIDParam 解析路径参数中的无符号整型 ID；失败时直接写出 400 并返回 false。
func parseIDParam(c *gin.Context, name string) (uint, bool) {
	v, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil || v == 0 {
		response.BadRequest(c, "无效的"+name)
		return 0, false
	}
	return uint(v), true
}

// parseUintQuery 解析查询参数为无符号整型；缺失或非法返回 0（表示不过滤）。
func parseUintQuery(c *gin.Context, name string) uint {
	v, err := strconv.ParseUint(c.Query(name), 10, 64)
	if err != nil {
		return 0
	}
	return uint(v)
}

// parseIntQuery 解析查询参数为整型；缺失或非法返回 0。
func parseIntQuery(c *gin.Context, name string) int {
	v, err := strconv.Atoi(c.Query(name))
	if err != nil {
		return 0
	}
	return v
}

// parseIntPtrQuery 解析整型查询参数为指针；缺失或非法返回 nil（表示不过滤）。
func parseIntPtrQuery(c *gin.Context, name string) *int {
	if c.Query(name) == "" {
		return nil
	}
	v, err := strconv.Atoi(c.Query(name))
	if err != nil {
		return nil
	}
	return &v
}

// parsePagination 解析分页参数，默认 page=1、page_size=20，page_size 上限 100。
func parsePagination(c *gin.Context) (page, pageSize int) {
	page, pageSize = 1, 20
	if v, err := strconv.Atoi(c.Query("page")); err == nil && v > 0 {
		page = v
	}
	if v, err := strconv.Atoi(c.Query("page_size")); err == nil && v > 0 {
		pageSize = v
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return
}

// parseBoolQuery 解析布尔查询参数；缺失返回 nil（表示不过滤）。
func parseBoolQuery(c *gin.Context, name string) *bool {
	s := c.Query(name)
	if s == "" {
		return nil
	}
	b := s == "true" || s == "1"
	return &b
}

// mapCommonError 将跨模块通用业务错误映射为统一响应。
func mapCommonError(c *gin.Context, err error) {
	var validationErr *service.ValidationError
	switch {
	case errors.As(err, &validationErr):
		response.BadRequest(c, validationErr.Msg)
	case errors.Is(err, service.ErrNotFound):
		response.NotFound(c, err.Error())
	case errors.Is(err, service.ErrDuplicate):
		response.Conflict(c, err.Error())
	case errors.Is(err, service.ErrInUse):
		response.Conflict(c, err.Error())
	case errors.Is(err, service.ErrInvalidRef):
		response.BadRequest(c, err.Error())
	case errors.Is(err, service.ErrForbidden):
		response.Forbidden(c, err.Error())
	default:
		response.ServerError(c, "操作失败")
	}
}
