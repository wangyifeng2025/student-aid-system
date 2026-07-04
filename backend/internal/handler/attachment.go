package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

// UploadRecognitionAttachment 上传认定申请支撑材料（仅申请所属学生）。
func (h *Handler) UploadRecognitionAttachment(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	fh, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "请通过 file 字段上传文件")
		return
	}
	res, err := h.Attachment.UploadToRecognition(actor, id, fh)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// ListRecognitionAttachments 列出认定申请的支撑材料（按数据范围）。
func (h *Handler) ListRecognitionAttachments(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.Attachment.ListForRecognition(actor, id)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}

// DownloadAttachment 下载附件（按数据范围校验访问权）。
func (h *Handler) DownloadAttachment(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	att, absPath, err := h.Attachment.OpenForDownload(actor, id)
	if err != nil {
		mapCommonError(c, err)
		return
	}
	c.FileAttachment(absPath, att.FileName)
}

// DeleteAttachment 删除附件（仅申请所属学生）。
func (h *Handler) DeleteAttachment(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.Attachment.Delete(actor, id); err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, gin.H{"message": "删除成功"})
}
