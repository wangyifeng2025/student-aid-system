package handler

import (
	"mime/multipart"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

const xlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

// DownloadImportTemplate 下载导入模板（students | special-groups）。
func (h *Handler) DownloadImportTemplate(c *gin.Context) {
	kind := c.Param("type")
	data, filename, err := h.Import.Template(kind)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Data(http.StatusOK, xlsxContentType, data)
}

// ImportStudents 上传 Excel 导入录取/新生名单。
func (h *Handler) ImportStudents(c *gin.Context) {
	f, ok := openUpload(c)
	if !ok {
		return
	}
	defer f.Close()
	res, err := h.Import.ImportStudents(f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// ImportSpecialGroups 上传 Excel 导入重点保障人群名单。
func (h *Handler) ImportSpecialGroups(c *gin.Context) {
	f, ok := openUpload(c)
	if !ok {
		return
	}
	defer f.Close()
	res, err := h.Import.ImportSpecialGroups(f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// ImportDepartments 上传 Excel 导入院系。
func (h *Handler) ImportDepartments(c *gin.Context) {
	f, ok := openUpload(c)
	if !ok {
		return
	}
	defer f.Close()
	res, err := h.Import.ImportDepartments(f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// ImportMajors 上传 Excel 导入专业。
func (h *Handler) ImportMajors(c *gin.Context) {
	f, ok := openUpload(c)
	if !ok {
		return
	}
	defer f.Close()
	res, err := h.Import.ImportMajors(f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// ImportGrades 上传 Excel 导入年级。
func (h *Handler) ImportGrades(c *gin.Context) {
	f, ok := openUpload(c)
	if !ok {
		return
	}
	defer f.Close()
	res, err := h.Import.ImportGrades(f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// ImportClasses 上传 Excel 导入班级。
func (h *Handler) ImportClasses(c *gin.Context) {
	f, ok := openUpload(c)
	if !ok {
		return
	}
	defer f.Close()
	res, err := h.Import.ImportClasses(f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// ExportOrg 导出组织机构 Excel（departments | majors | grades | classes）。
func (h *Handler) ExportOrg(c *gin.Context) {
	kind := c.Param("type")
	data, filename, err := h.Import.Export(kind)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Data(http.StatusOK, xlsxContentType, data)
}

// ExportStudents 导出学生信息 Excel（支持与列表相同的筛选条件，不分页）。
func (h *Handler) ExportStudents(c *gin.Context) {
	f := repository.StudentFilter{
		DeptID:     parseUintQuery(c, "dept_id"),
		MajorID:    parseUintQuery(c, "major_id"),
		ClassID:    parseUintQuery(c, "class_id"),
		Keyword:    c.Query("keyword"),
		IsKeyGroup: parseBoolQuery(c, "is_key_group"),
	}
	data, filename, err := h.Import.ExportStudents(f)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Data(http.StatusOK, xlsxContentType, data)
}

// openUpload 读取 multipart 表单中的 file 字段并打开为可读流。
func openUpload(c *gin.Context) (multipart.File, bool) {
	fh, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "请通过 file 字段上传 Excel 文件")
		return nil, false
	}
	f, err := fh.Open()
	if err != nil {
		response.ServerError(c, "读取上传文件失败")
		return nil, false
	}
	return f, true
}
