package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/middleware"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

const zipContentType = "application/zip"

// ListBackups 列出服务器上已有的备份归档。
func (h *Handler) ListBackups(c *gin.Context) {
	items, err := h.Backup.List()
	if err != nil {
		response.ServerError(c, "读取备份目录失败")
		return
	}
	response.OK(c, items)
}

// CreateBackup 立即生成一份全量备份。
func (h *Handler) CreateBackup(c *gin.Context) {
	var req dto.CreateBackupRequest
	// 允许空 body：默认连同附件一起备份。
	_ = c.ShouldBindJSON(&req)

	item, err := h.Backup.Create(currentOperator(c), req)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, item)
}

// DownloadBackup 下载备份归档，便于管理员保存到异地。
func (h *Handler) DownloadBackup(c *gin.Context) {
	name := c.Param("name")
	p, err := h.Backup.Locate(name)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	c.Header("Content-Disposition", attachmentDisposition(name, name))
	c.Header("Content-Type", zipContentType)
	c.File(p)
}

// DeleteBackup 删除指定备份归档。
func (h *Handler) DeleteBackup(c *gin.Context) {
	if err := h.Backup.Delete(c.Param("name")); err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "已删除"})
}

// RestoreBackupFromServer 用服务器上已有的归档恢复全量数据。
func (h *Handler) RestoreBackupFromServer(c *gin.Context) {
	res, err := h.Backup.RestoreFromStored(currentOperator(c), c.Param("name"))
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// RestoreBackupFromUpload 用管理员上传的归档恢复全量数据。
func (h *Handler) RestoreBackupFromUpload(c *gin.Context) {
	fh, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "请通过 file 字段上传 .zip 备份文件")
		return
	}
	f, err := fh.Open()
	if err != nil {
		response.ServerError(c, "读取上传文件失败")
		return
	}
	defer f.Close()

	res, err := h.Backup.RestoreFromUpload(currentOperator(c), fh.Filename, f, fh.Size)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// currentOperator 取当前操作人用于写入 manifest，便于事后追溯是谁做的备份/恢复。
func currentOperator(c *gin.Context) string {
	if u, ok := middleware.CurrentUser(c); ok && u != nil {
		if u.RealName != "" {
			return u.Username + "（" + u.RealName + "）"
		}
		return u.Username
	}
	return "unknown"
}
