package handler

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

// Health 健康检查
func (h *Handler) Health(c *gin.Context) {
	response.OK(c, gin.H{
		"status": "ok",
		"app":    h.Cfg.App.Name,
		"env":    h.Cfg.App.Env,
		"time":   time.Now().Format(time.RFC3339),
	})
}
