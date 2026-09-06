package handler

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

// ===== 学生 Student =====

func (h *Handler) ListStudents(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	page, pageSize := parsePagination(c)
	f := repository.StudentFilter{
		DeptID:            parseUintQuery(c, "dept_id"),
		MajorID:           parseUintQuery(c, "major_id"),
		ClassID:           parseUintQuery(c, "class_id"),
		Keyword:           c.Query("keyword"),
		IsKeyGroup:        parseBoolQuery(c, "is_key_group"),
		Year:              parseIntQuery(c, "year"),
		RecognitionStatus: strings.TrimSpace(c.Query("recognition_status")),
		DifficultyLevel:   strings.TrimSpace(c.Query("difficulty_level")),
		Page:              page,
		PageSize:          pageSize,
	}
	res, err := h.Student.List(f, actor)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) GetStudent(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.Student.Get(id, actor, parseIntQuery(c, "year"))
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// GetMyStudent 学生本人获取关联学籍档案（用于认定填报等场景）。
func (h *Handler) GetMyStudent(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	if actor.Role != model.RoleStudent {
		response.Forbidden(c, "仅学生可访问本人学籍信息")
		return
	}
	res, err := h.Student.GetByUserID(actor.UserID)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) CreateStudent(c *gin.Context) {
	var req dto.StudentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Student.Create(&req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) UpdateStudent(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req dto.StudentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.Student.Update(id, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) DeleteStudent(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.Student.Delete(id); err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "删除成功"})
}

// ===== 重点人群 SpecialGroup =====

func (h *Handler) ListSpecialGroups(c *gin.Context) {
	page, pageSize := parsePagination(c)
	f := repository.SpecialGroupFilter{
		Type:     c.Query("type"),
		Year:     parseIntQuery(c, "year"),
		Keyword:  c.Query("keyword"),
		Page:     page,
		PageSize: pageSize,
	}
	res, err := h.SpecialGroup.List(f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) GetSpecialGroup(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.SpecialGroup.Get(id)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) CreateSpecialGroup(c *gin.Context) {
	var req dto.SpecialGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.SpecialGroup.Create(&req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) UpdateSpecialGroup(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req dto.SpecialGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	res, err := h.SpecialGroup.Update(id, &req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

func (h *Handler) DeleteSpecialGroup(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.SpecialGroup.Delete(id); err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "删除成功"})
}
