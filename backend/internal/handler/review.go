package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

// ListReviewTodo 按角色 + 数据范围列出待办评审。
func (h *Handler) ListReviewTodo(c *gin.Context) {
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
		DeptID:      parseUintQuery(c, "dept_id"),
		ClassID:     parseUintQuery(c, "class_id"),
		Page:        page,
		PageSize:    pageSize,
	}
	res, err := h.Review.Todo(actor, f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// ListReviewRecords 按 tab 列出认定记录（todo/done/all），不含学生未提交草稿。
func (h *Handler) ListReviewRecords(c *gin.Context) {
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
		DeptID:      parseUintQuery(c, "dept_id"),
		ClassID:     parseUintQuery(c, "class_id"),
		Page:        page,
		PageSize:    pageSize,
	}
	res, err := h.Review.Records(actor, c.Query("tab"), f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// GetReviewDetail 评审详情（复用认定详情，含家庭成员与流转记录，按数据范围校验）。
func (h *Handler) GetReviewDetail(c *gin.Context) {
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

// PassReview 通过评审（可初定/调整困难等级）。
func (h *Handler) PassReview(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req dto.ReviewActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// 通过动作允许空 body（无意见、无调整等级）
		req = dto.ReviewActionRequest{}
	}
	res, err := h.Review.Pass(actor, id, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// RejectReview 退回评审（指定退回级别 + 退回意见）。
func (h *Handler) RejectReview(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req dto.ReviewActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Review.Reject(actor, id, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// WithdrawReview 撤回本人最近一次评审意见（下级尚未审核时可撤销）。
func (h *Handler) WithdrawReview(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.Review.Withdraw(actor, id)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// BatchReview 批量评审（快速定档/批量退回）。
func (h *Handler) BatchReview(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	var req dto.BatchReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Review.Batch(actor, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}
