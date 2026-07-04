package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

// ListDictTypes 返回所有字典类型。
func (h *Handler) ListDictTypes(c *gin.Context) {
	types, err := h.Dict.ListTypes()
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, types)
}

// ListDictByType 按类型返回字典项（前端下拉来源）。
func (h *Handler) ListDictByType(c *gin.Context) {
	items, err := h.Dict.ListByType(c.Param("type"))
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, items)
}

// CreateDict 在指定类型下新增字典项。
func (h *Handler) CreateDict(c *gin.Context) {
	var req dto.DictCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Dict.CreateDict(c.Param("type"), &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// UpdateDict 修改字典项的显示文案与排序（type+code 标识不可改）。
func (h *Handler) UpdateDict(c *gin.Context) {
	var req dto.DictUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Dict.UpdateDict(c.Param("type"), c.Param("code"), &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// DeleteDict 删除字典项。
func (h *Handler) DeleteDict(c *gin.Context) {
	if err := h.Dict.DeleteDict(c.Param("type"), c.Param("code")); err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "删除成功"})
}
