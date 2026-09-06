package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

func (h *Handler) ListAdvisors(c *gin.Context) {
	page, pageSize := parsePagination(c)
	f := repository.AdvisorFilter{
		DeptID:   parseUintQuery(c, "dept_id"),
		Keyword:  c.Query("keyword"),
		Page:     page,
		PageSize: pageSize,
	}
	res, err := h.Advisor.List(f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) GetAdvisor(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.Advisor.Get(id)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) CreateAdvisor(c *gin.Context) {
	var req dto.AdvisorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Advisor.Create(&req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) UpdateAdvisor(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req dto.AdvisorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Advisor.Update(id, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) DeleteAdvisor(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.Advisor.Delete(id); err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "删除成功"})
}

func (h *Handler) ImportAdvisors(c *gin.Context) {
	f, ok := openUpload(c)
	if !ok {
		return
	}
	defer f.Close()
	res, err := h.Import.ImportAdvisors(f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) ExportAdvisors(c *gin.Context) {
	f := repository.AdvisorFilter{
		DeptID:  parseUintQuery(c, "dept_id"),
		Keyword: c.Query("keyword"),
		IDs:     parseUintListQuery(c, "ids"),
	}
	data, filename, err := h.Import.ExportAdvisors(f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Data(200, xlsxContentType, data)
}
