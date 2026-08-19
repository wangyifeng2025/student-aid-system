package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
)

// DashboardOverview 工作台概览：按当前用户角色与数据范围返回指标、待办与最近记录。
func (h *Handler) DashboardOverview(c *gin.Context) {
	actor, ok := currentActor(c)
	if !ok {
		return
	}
	res, err := h.Dashboard.Overview(actor, parseIntQuery(c, "year"))
	if err != nil {
		mapCommonError(c, err)
		return
	}
	response.OK(c, res)
}
