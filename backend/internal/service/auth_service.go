package service

import (
	"errors"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/jwt"
	"github.com/wangyifeng2025/student-aid-system/pkg/password"
	"gorm.io/gorm"
)

// 业务错误（handler 层映射为 HTTP 状态码）。
var (
	ErrInvalidCredentials = errors.New("用户名或密码错误")
	ErrAccountDisabled    = errors.New("账号已被禁用")
	ErrInvalidToken       = errors.New("令牌无效或已过期")
	ErrInvalidPassword    = errors.New("原密码错误")
	ErrPhoneMismatch      = errors.New("手机号与账号不匹配")
	ErrForbidden          = errors.New("没有访问权限")
)

// AuthService 认证业务逻辑。
type AuthService struct {
	users    *repository.UserRepository
	advisors *repository.AdvisorRepository
	jwt      *jwt.Manager
}

func NewAuthService(db *gorm.DB, jwtMgr *jwt.Manager) *AuthService {
	return &AuthService{
		users:    repository.NewUserRepository(db),
		advisors: repository.NewAdvisorRepository(db),
		jwt:      jwtMgr,
	}
}

// Login 账号密码登录。
func (s *AuthService) Login(req *dto.LoginRequest) (*dto.TokenResponse, error) {
	user, err := s.users.FindByUsername(req.Username)
	if repository.IsNotFound(err) {
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, err
	}
	if user.Status != 1 {
		return nil, ErrAccountDisabled
	}
	if err := password.Verify(user.PasswordHash, req.Password); err != nil {
		return nil, ErrInvalidCredentials
	}
	return s.buildTokenResponse(user)
}

// Refresh 使用 refresh token 换取新双令牌。
func (s *AuthService) Refresh(refreshToken string) (*dto.TokenResponse, error) {
	claims, err := s.jwt.ParseRefresh(refreshToken)
	if err != nil {
		return nil, ErrInvalidToken
	}
	user, err := s.users.FindByID(claims.UserID)
	if repository.IsNotFound(err) {
		return nil, ErrInvalidToken
	}
	if err != nil {
		return nil, err
	}
	if user.Status != 1 {
		return nil, ErrAccountDisabled
	}
	return s.buildTokenResponse(user)
}

// ChangePassword 登录用户修改密码。
func (s *AuthService) ChangePassword(userID uint, req *dto.ChangePasswordRequest) error {
	if err := password.Validate(req.NewPassword); err != nil {
		return err
	}
	user, err := s.users.FindByID(userID)
	if repository.IsNotFound(err) {
		return ErrInvalidCredentials
	}
	if err != nil {
		return err
	}
	if err := password.Verify(user.PasswordHash, req.OldPassword); err != nil {
		return ErrInvalidPassword
	}
	hash, err := password.Hash(req.NewPassword)
	if err != nil {
		return err
	}
	return s.users.UpdatePassword(userID, hash)
}

// RecoverPassword 通过用户名+手机号找回密码。
func (s *AuthService) RecoverPassword(req *dto.RecoverPasswordRequest) error {
	if err := password.Validate(req.NewPassword); err != nil {
		return err
	}
	user, err := s.users.FindByUsername(req.Username)
	if repository.IsNotFound(err) {
		return ErrInvalidCredentials
	}
	if err != nil {
		return err
	}
	if user.Phone == "" || user.Phone != req.Phone {
		return ErrPhoneMismatch
	}
	hash, err := password.Hash(req.NewPassword)
	if err != nil {
		return err
	}
	return s.users.UpdatePassword(user.ID, hash)
}

// AdminResetPassword 管理员重置指定用户密码。
func (s *AuthService) AdminResetPassword(actor *model.User, req *dto.AdminResetPasswordRequest) error {
	if actor.Role != model.RoleAdmin {
		return ErrForbidden
	}
	if err := password.Validate(req.NewPassword); err != nil {
		return err
	}
	hash, err := password.Hash(req.NewPassword)
	if err != nil {
		return err
	}
	if err := s.users.UpdatePassword(req.UserID, hash); err != nil {
		if repository.IsNotFound(err) {
			return ErrInvalidCredentials
		}
		return err
	}
	return nil
}

// GetMe 获取当前用户信息与权限。
func (s *AuthService) GetMe(userID uint) (*dto.MeResponse, error) {
	user, err := s.users.FindByID(userID)
	if repository.IsNotFound(err) {
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, err
	}
	actor := rbac.NewActor(user)
	return &dto.MeResponse{
		UserBrief:   dto.ToUserBrief(user, s.classIDsFor(user)),
		DataScope:   string(actor.Scope()),
		Permissions: permissionsForRole(user.Role),
	}, nil
}

func (s *AuthService) buildTokenResponse(user *model.User) (*dto.TokenResponse, error) {
	pair, err := s.jwt.GeneratePair(user)
	if err != nil {
		return nil, err
	}
	return &dto.TokenResponse{
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
		ExpiresIn:    pair.ExpiresIn,
		User:         dto.ToUserBrief(user, s.classIDsFor(user)),
	}, nil
}

func (s *AuthService) classIDsFor(u *model.User) []uint {
	if u == nil || u.Role != model.RoleClassAdvisor {
		return nil
	}
	ids, err := s.advisors.ListClassIDsByUserID(u.ID)
	if err != nil {
		return nil
	}
	return ids
}

// permissionsForRole 返回角色对应的权限标识列表（供前端菜单/按钮控制）。
func permissionsForRole(role model.Role) []string {
	base := []string{"auth:me", "auth:change_password"}
	switch role {
	case model.RoleStudent:
		return append(base, "recognition:own", "grant:own")
	case model.RoleClassAdvisor:
		return append(base, "review:class", "student:view_class")
	case model.RoleDepartment:
		return append(base, "review:department", "student:view_dept")
	case model.RoleAidCenter:
		return append(base, "review:college", "student:view_school", "import:export", "publicity:manage")
	case model.RoleAdmin:
		return append(base, "admin:all", "user:manage", "auth:reset_password")
	default:
		return base
	}
}
