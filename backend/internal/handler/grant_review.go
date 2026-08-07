package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

func (h *Handler) ListGrantReviewTodo(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	page, pageSize := parsePagination(c)
	f := repository.GrantFilter{
		Year:     parseIntQuery(c, "year"),
		Status:   c.Query("status"),
		Keyword:  c.Query("keyword"),
		DeptID:   parseUintQuery(c, "dept_id"),
		ClassID:  parseUintQuery(c, "class_id"),
		Page:     page,
		PageSize: pageSize,
	}
	res, err := h.GrantReview.Todo(actor, f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) ListGrantReviewRecords(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	page, pageSize := parsePagination(c)
	f := repository.GrantFilter{
		Year:     parseIntQuery(c, "year"),
		Status:   c.Query("status"),
		Keyword:  c.Query("keyword"),
		DeptID:   parseUintQuery(c, "dept_id"),
		ClassID:  parseUintQuery(c, "class_id"),
		Page:     page,
		PageSize: pageSize,
	}
	res, err := h.GrantReview.Records(actor, c.Query("tab"), f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) GetGrantReviewDetail(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.GrantReview.Get(actor, id)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) PassGrantReview(c *gin.Context) {
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
		req = dto.ReviewActionRequest{}
	}
	res, err := h.GrantReview.Pass(actor, id, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) RejectGrantReview(c *gin.Context) {
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
	res, err := h.GrantReview.Reject(actor, id, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) WithdrawGrantReview(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.GrantReview.Withdraw(actor, id)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}
