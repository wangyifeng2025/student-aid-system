package service

import (
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/password"
	"github.com/wangyifeng2025/student-aid-system/pkg/validate"
	"gorm.io/gorm"
)

// UserService 用户管理业务逻辑（模块 10，仅管理员）。
type UserService struct {
	repo *repository.UserRepository
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{repo: repository.NewUserRepository(db)}
}

// List 分页列出用户。
func (s *UserService) List(f repository.UserFilter) (*dto.PageResult[dto.UserResponse], error) {
	items, total, err := s.repo.ListUsers(f)
	if err != nil {
		return nil, err
	}
	return &dto.PageResult[dto.UserResponse]{
		Items:    dto.ToUserResponses(items),
		Total:    total,
		Page:     f.Page,
		PageSize: f.PageSize,
	}, nil
}

// Get 用户详情。
func (s *UserService) Get(id uint) (*dto.UserResponse, error) {
	u, err := s.repo.FindByID(id)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	resp := dto.ToUserResponse(u)
	return &resp, nil
}

// Create 新建用户。
func (s *UserService) Create(req *dto.UserCreateRequest) (*dto.UserResponse, error) {
	username := strings.TrimSpace(req.Username)
	if username == "" {
		return nil, NewValidationError("用户名不能为空")
	}
	if err := password.Validate(req.Password); err != nil {
		return nil, NewValidationError(err.Error())
	}
	exists, err := s.repo.UsernameExists(username, 0)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrDuplicate
	}

	u := &model.User{Username: username}
	if err := s.applyCommon(u, commonUserInput{
		RealName: req.RealName,
		Role:     req.Role,
		Phone:    req.Phone,
		DeptID:   req.DeptID,
		ClassID:  req.ClassID,
		Status:   req.Status,
	}); err != nil {
		return nil, err
	}
	hash, err := password.Hash(req.Password)
	if err != nil {
		return nil, err
	}
	u.PasswordHash = hash
	if req.Status == nil {
		u.Status = 1
	}

	if err := s.repo.Create(u); err != nil {
		return nil, err
	}
	resp := dto.ToUserResponse(u)
	return &resp, nil
}

// Update 修改用户（不含用户名与密码）。
func (s *UserService) Update(actorID, id uint, req *dto.UserUpdateRequest) (*dto.UserResponse, error) {
	u, err := s.repo.FindByID(id)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	// 防止把自己降级或禁用，导致失去管理员入口。
	if id == actorID {
		if req.Role != string(model.RoleAdmin) {
			return nil, NewValidationError("不能修改自己的角色")
		}
		if req.Status != nil && *req.Status != 1 {
			return nil, NewValidationError("不能禁用自己的账号")
		}
	}
	// 保护最后一名启用管理员：不允许将其降级/禁用。
	if u.Role == model.RoleAdmin {
		downgrade := req.Role != string(model.RoleAdmin)
		disable := req.Status != nil && *req.Status != 1
		if downgrade || disable {
			others, cErr := s.repo.CountByRole(model.RoleAdmin, id)
			if cErr != nil {
				return nil, cErr
			}
			if others == 0 {
				return nil, NewValidationError("系统至少需保留一名管理员")
			}
		}
	}

	if err := s.applyCommon(u, commonUserInput{
		RealName: req.RealName,
		Role:     req.Role,
		Phone:    req.Phone,
		DeptID:   req.DeptID,
		ClassID:  req.ClassID,
		Status:   req.Status,
	}); err != nil {
		return nil, err
	}
	if err := s.repo.Save(u); err != nil {
		return nil, err
	}
	resp := dto.ToUserResponse(u)
	return &resp, nil
}

// Delete 删除用户（禁止删除自己与最后一名管理员）。
func (s *UserService) Delete(actorID, id uint) error {
	if id == actorID {
		return NewValidationError("不能删除当前登录账号")
	}
	u, err := s.repo.FindByID(id)
	if repository.IsNotFound(err) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if u.Role == model.RoleAdmin {
		others, cErr := s.repo.CountByRole(model.RoleAdmin, id)
		if cErr != nil {
			return cErr
		}
		if others == 0 {
			return NewValidationError("系统至少需保留一名管理员")
		}
	}
	return s.repo.Delete(id)
}

// ResetPassword 管理员重置指定用户密码。
func (s *UserService) ResetPassword(id uint, newPassword string) error {
	if err := password.Validate(newPassword); err != nil {
		return NewValidationError(err.Error())
	}
	if _, err := s.repo.FindByID(id); err != nil {
		if repository.IsNotFound(err) {
			return ErrNotFound
		}
		return err
	}
	hash, err := password.Hash(newPassword)
	if err != nil {
		return err
	}
	return s.repo.UpdatePassword(id, hash)
}

// commonUserInput 创建/修改共用的可写字段。
type commonUserInput struct {
	RealName string
	Role     string
	Phone    string
	DeptID   *uint
	ClassID  *uint
	Status   *int
}

// applyCommon 校验并写入用户公共字段。
func (s *UserService) applyCommon(u *model.User, in commonUserInput) error {
	realName := strings.TrimSpace(in.RealName)
	if realName == "" {
		return NewValidationError("姓名不能为空")
	}
	if !model.IsValidRole(in.Role) {
		return NewValidationError("角色取值无效")
	}
	phone := strings.TrimSpace(in.Phone)
	if phone != "" && !validate.Phone(phone) {
		return NewValidationError("手机号格式不正确")
	}

	deptID, err := s.normalizeDept(in.DeptID)
	if err != nil {
		return err
	}
	classID, err := s.normalizeClass(in.ClassID)
	if err != nil {
		return err
	}

	u.RealName = realName
	u.Role = model.Role(in.Role)
	u.Phone = phone
	u.DeptID = deptID
	u.ClassID = classID
	if in.Status != nil {
		if *in.Status != 0 && *in.Status != 1 {
			return NewValidationError("状态取值无效（0 禁用 / 1 启用）")
		}
		u.Status = *in.Status
	}
	return nil
}

// normalizeDept 校验院系存在性；空或 0 视为不设置（返回 nil）。
func (s *UserService) normalizeDept(id *uint) (*uint, error) {
	if id == nil || *id == 0 {
		return nil, nil
	}
	ok, err := s.repo.DeptExists(*id)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, NewValidationError("所属院系不存在")
	}
	return id, nil
}

// normalizeClass 校验班级存在性；空或 0 视为不设置（返回 nil）。
func (s *UserService) normalizeClass(id *uint) (*uint, error) {
	if id == nil || *id == 0 {
		return nil, nil
	}
	ok, err := s.repo.ClassExists(*id)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, NewValidationError("所属班级不存在")
	}
	return id, nil
}
