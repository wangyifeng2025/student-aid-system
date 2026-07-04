package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/jwt"
	"github.com/wangyifeng2025/student-aid-system/pkg/response"
	"gorm.io/gorm"
)

// 上下文键
const (
	CtxUserID      = "ctx_user_id"
	CtxUsername    = "ctx_username"
	CtxRole        = "ctx_role"
	CtxCurrentUser = "ctx_current_user"
	CtxActor       = "ctx_actor"
	CtxDataScope   = "ctx_data_scope"
)

// JWTAuth 校验 Authorization: Bearer <access_token>
func JWTAuth(mgr *jwt.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			response.Unauthorized(c, "缺少或无效的认证令牌")
			c.Abort()
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := mgr.Parse(tokenStr)
		if err != nil {
			response.Unauthorized(c, "令牌无效或已过期")
			c.Abort()
			return
		}
		c.Set(CtxUserID, claims.UserID)
		c.Set(CtxUsername, claims.Username)
		c.Set(CtxRole, claims.Role)
		c.Next()
	}
}

// LoadCurrentUser 在 JWT 校验后加载完整用户实体与 RBAC Actor。
func LoadCurrentUser(db *gorm.DB) gin.HandlerFunc {
	repo := repository.NewUserRepository(db)
	return func(c *gin.Context) {
		uid := CurrentUserID(c)
		if uid == 0 {
			response.Unauthorized(c, "未认证")
			c.Abort()
			return
		}
		user, err := repo.FindByID(uid)
		if err != nil {
			if repository.IsNotFound(err) {
				response.Unauthorized(c, "用户不存在")
			} else {
				response.ServerError(c, "加载用户信息失败")
			}
			c.Abort()
			return
		}
		if user.Status != 1 {
			response.Forbidden(c, "账号已被禁用")
			c.Abort()
			return
		}
		actor := rbac.NewActor(user)
		c.Set(CtxCurrentUser, user)
		c.Set(CtxActor, actor)
		c.Set(CtxDataScope, string(actor.Scope()))
		c.Next()
	}
}

// RequireRoles 角色访问控制。
func RequireRoles(roles ...model.Role) gin.HandlerFunc {
	allowed := make(map[model.Role]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(c *gin.Context) {
		val, exists := c.Get(CtxRole)
		if !exists {
			response.Unauthorized(c, "未认证")
			c.Abort()
			return
		}
		role, _ := val.(model.Role)
		if _, ok := allowed[role]; !ok {
			response.Forbidden(c, "没有访问权限")
			c.Abort()
			return
		}
		c.Next()
	}
}

// CurrentUserID 从上下文取当前用户 ID。
func CurrentUserID(c *gin.Context) uint {
	if v, ok := c.Get(CtxUserID); ok {
		if id, ok := v.(uint); ok {
			return id
		}
	}
	return 0
}

// CurrentUser 从上下文取当前用户实体（需先经过 LoadCurrentUser）。
func CurrentUser(c *gin.Context) (*model.User, bool) {
	v, ok := c.Get(CtxCurrentUser)
	if !ok {
		return nil, false
	}
	user, ok := v.(*model.User)
	return user, ok
}

// CurrentActor 从上下文取 RBAC Actor。
func CurrentActor(c *gin.Context) (rbac.Actor, bool) {
	v, ok := c.Get(CtxActor)
	if !ok {
		return rbac.Actor{}, false
	}
	actor, ok := v.(rbac.Actor)
	return actor, ok
}
