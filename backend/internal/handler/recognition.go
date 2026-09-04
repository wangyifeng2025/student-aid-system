package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

// ListRecognitions 按数据范围分页列出认定申请。
func (h *Handler) ListRecognitions(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	page, pageSize := parsePagination(c)
	f := repository.RecognitionFilter{
		Year:        parseIntQuery(c, "year"),
		Status:      c.Query("status"),
		Keyword:     c.Query("keyword"),
		SpecialType: c.Query("special_type"),
		Page:        page,
		PageSize:    pageSize,
	}
	res, err := h.Recognition.List(actor, f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// GetRecognition 认定申请详情。
func (h *Handler) GetRecognition(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.Recognition.Get(actor, id)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// CreateRecognition 学生本人创建认定申请（草稿）。
func (h *Handler) CreateRecognition(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	var req dto.RecognitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Recognition.Create(actor, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// UpdateRecognition 学生本人修改草稿/被退回的申请。
func (h *Handler) UpdateRecognition(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req dto.RecognitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Recognition.Update(actor, id, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// DeleteRecognition 学生本人删除未提交的申请（草稿/被退回）。
func (h *Handler) DeleteRecognition(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.Recognition.Delete(actor, id); err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "删除成功"})
}

// SubmitRecognition 提交评审（完整校验 + 单亲/单薪提示）。
func (h *Handler) SubmitRecognition(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.Recognition.Submit(actor, id)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// WithdrawRecognition 学生本人撤回已提交但尚未经班级审核的申请。
func (h *Handler) WithdrawRecognition(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.Recognition.Withdraw(actor, id)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// ExportRecognitionPDF 导出认定申请表 PDF（仅认定通过后）。
func (h *Handler) ExportRecognitionPDF(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	data, filename, err := h.RecognitionPDF.Export(actor, id)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	c.Header("Content-Disposition", attachmentDisposition("recognition-application.pdf", filename))
	c.Data(http.StatusOK, "application/pdf", data)
}

// ExportRecognitionSummary 导出家庭经济困难学生认定结果汇总表（评审角色与管理员）。
func (h *Handler) ExportRecognitionSummary(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	f := repository.RecognitionFilter{
		Year:        parseIntQuery(c, "year"),
		Keyword:     c.Query("keyword"),
		SpecialType: c.Query("special_type"),
		DeptID:      parseUintQuery(c, "dept_id"),
		ClassID:     parseUintQuery(c, "class_id"),
		Status:      c.Query("status"),
		IDs:         parseUintListQuery(c, "ids"),
	}
	data, filename, asciiName, err := h.RecognitionSummary.Export(actor, f, c.Query("scope"))
	if err != nil {
		mapCommonError(c, err)
		return
	}
	c.Header("Content-Disposition", attachmentDisposition(asciiName, filename))
	c.Data(http.StatusOK, xlsxContentType, data)
}
