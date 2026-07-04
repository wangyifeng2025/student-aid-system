package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

// ===== 院系 Department =====

func (h *Handler) ListDepartments(c *gin.Context) {
	items, err := h.Org.ListDepartments()
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, items)
}

func (h *Handler) CreateDepartment(c *gin.Context) {
	var req dto.DepartmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Org.CreateDepartment(&req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) UpdateDepartment(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req dto.DepartmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Org.UpdateDepartment(id, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) DeleteDepartment(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.Org.DeleteDepartment(id); err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "删除成功"})
}

// ===== 专业 Major =====

func (h *Handler) ListMajors(c *gin.Context) {
	items, err := h.Org.ListMajors(parseUintQuery(c, "dept_id"))
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, items)
}

func (h *Handler) CreateMajor(c *gin.Context) {
	var req dto.MajorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Org.CreateMajor(&req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) UpdateMajor(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req dto.MajorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Org.UpdateMajor(id, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) DeleteMajor(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.Org.DeleteMajor(id); err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "删除成功"})
}

// ===== 年级 Grade =====

func (h *Handler) ListGrades(c *gin.Context) {
	items, err := h.Org.ListGrades()
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, items)
}

func (h *Handler) CreateGrade(c *gin.Context) {
	var req dto.GradeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Org.CreateGrade(&req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) UpdateGrade(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req dto.GradeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Org.UpdateGrade(id, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) DeleteGrade(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.Org.DeleteGrade(id); err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "删除成功"})
}

// ===== 班级 Class =====

func (h *Handler) ListClasses(c *gin.Context) {
	items, err := h.Org.ListClasses(
		parseUintQuery(c, "dept_id"),
		parseUintQuery(c, "major_id"),
		parseUintQuery(c, "grade_id"),
	)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, items)
}

func (h *Handler) CreateClass(c *gin.Context) {
	var req dto.ClassRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Org.CreateClass(&req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) UpdateClass(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req dto.ClassRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Org.UpdateClass(id, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) DeleteClass(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.Org.DeleteClass(id); err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "删除成功"})
}
