package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

func (h *Handler) ListGrants(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	page, pageSize := parsePagination(c)
	f := repository.GrantFilter{
		Year:      parseIntQuery(c, "year"),
		Status:    c.Query("status"),
		GrantType: c.Query("grant_type"),
		Keyword:   c.Query("keyword"),
		Page:      page,
		PageSize:  pageSize,
	}
	res, err := h.Grant.List(actor, f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) GetGrant(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.Grant.Get(actor, id)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) CreateGrant(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	var req dto.CreateGrantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Grant.Create(actor, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) UpdateGrant(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req dto.GrantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Grant.Update(actor, id, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) DeleteGrant(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.Grant.Delete(actor, id); err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "已删除"})
}

func (h *Handler) SubmitGrant(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.Grant.Submit(actor, id)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) ExportGrantPDF(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	data, filename, err := h.GrantPDF.Export(actor, id)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Data(http.StatusOK, "application/pdf", data)
}
