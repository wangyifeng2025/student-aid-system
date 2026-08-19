package handler

import (
	"encoding/json"
	"io"

	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

// ListRegionCodes 列出行政区划。parent_code 为空时返回省级；keyword 为全局搜索。
func (h *Handler) ListRegionCodes(c *gin.Context) {
	f := repository.RegionCodeFilter{
		Keyword: c.Query("keyword"),
		Level:   parseIntQuery(c, "level"),
	}
	if f.Keyword == "" {
		parent := c.Query("parent_code")
		f.ParentCode = &parent
	}
	items, err := h.RegionCode.List(f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, items)
}

// GetRegionCode 按 6/12 位区划码查询。
func (h *Handler) GetRegionCode(c *gin.Context) {
	res, err := h.RegionCode.Get(c.Param("code"))
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// LookupRegionCode 按身份证号或 6 位区划码解析省/市/区。
func (h *Handler) LookupRegionCode(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		q = c.Query("id_card")
	}
	res, err := h.RegionCode.Lookup(q)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// CreateRegionCode 新增行政区划。
func (h *Handler) CreateRegionCode(c *gin.Context) {
	var req dto.RegionCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.RegionCode.Create(&req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// UpdateRegionCode 修改行政区划（编码不可改）。
func (h *Handler) UpdateRegionCode(c *gin.Context) {
	var req dto.RegionCodeUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.RegionCode.Update(c.Param("code"), &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// DeleteRegionCode 删除行政区划（有下级时禁止）。
func (h *Handler) DeleteRegionCode(c *gin.Context) {
	if err := h.RegionCode.Delete(c.Param("code")); err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "删除成功"})
}

// ImportRegionCodes 导入区划树 JSON（支持 {data:{children:[]}} 或节点本身）。
func (h *Handler) ImportRegionCodes(c *gin.Context) {
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil || len(raw) == 0 {
		response.BadRequest(c, "请提交行政区划 JSON")
		return
	}
	if !json.Valid(raw) {
		response.BadRequest(c, "JSON 格式不正确")
		return
	}
	res, err := h.RegionCode.ImportJSON(raw)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// ImportDefaultRegionCodes 导入系统内置的国家标准行政区划。
func (h *Handler) ImportDefaultRegionCodes(c *gin.Context) {
	res, err := h.RegionCode.ImportDefault()
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}
