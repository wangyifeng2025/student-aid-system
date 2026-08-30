package repository

import (
	"errors"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"gorm.io/gorm"
)

// UserRepository 用户数据访问。
type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) FindByID(id uint) (*model.User, error) {
	var user model.User
	if err := r.db.First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// FindNamesByIDs 批量按 ID 返回用户姓名映射（评审记录展示评审人姓名）。
func (r *UserRepository) FindNamesByIDs(ids []uint) (map[uint]string, error) {
	out := make(map[uint]string, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	var users []model.User
	if err := r.db.Select("id", "real_name", "username").
		Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, err
	}
	for i := range users {
		name := users[i].RealName
		if name == "" {
			name = users[i].Username
		}
		out[users[i].ID] = name
	}
	return out, nil
}

// FindUsernamesByIDs 批量按 ID 返回登录用户名映射（组织机构导出班主任）。
func (r *UserRepository) FindUsernamesByIDs(ids []uint) (map[uint]string, error) {
	out := make(map[uint]string, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	var users []model.User
	if err := r.db.Select("id", "username").Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, err
	}
	for i := range users {
		out[users[i].ID] = users[i].Username
	}
	return out, nil
}

func (r *UserRepository) FindByUsername(username string) (*model.User, error) {
	var user model.User
	if err := r.db.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) UpdatePassword(id uint, passwordHash string) error {
	result := r.db.Model(&model.User{}).Where("id = ?", id).Update("password_hash", passwordHash)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *UserRepository) Create(user *model.User) error {
	return r.db.Create(user).Error
}

func (r *UserRepository) ExistsByUsername(username string) (bool, error) {
	var count int64
	if err := r.db.Model(&model.User{}).Where("username = ?", username).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// UserFilter 用户列表过滤与分页条件（空值表示不过滤）。
type UserFilter struct {
	Role     string
	Status   *int
	Keyword  string // 用户名/姓名/手机号
	Page     int
	PageSize int
}

func (r *UserRepository) query(f UserFilter) *gorm.DB {
	q := r.db.Model(&model.User{})
	if f.Role != "" {
		q = q.Where("role = ?", f.Role)
	}
	if f.Status != nil {
		q = q.Where("status = ?", *f.Status)
	}
	if f.Keyword != "" {
		kw := "%" + f.Keyword + "%"
		q = q.Where("username LIKE ? OR real_name LIKE ? OR phone LIKE ?", kw, kw, kw)
	}
	return q
}

// ListUsers 分页列出用户，返回当前页与总数。
func (r *UserRepository) ListUsers(f UserFilter) ([]model.User, int64, error) {
	var total int64
	if err := r.query(f).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.User
	q := r.query(f).Order("id desc")
	if f.PageSize > 0 {
		q = q.Limit(f.PageSize).Offset((f.Page - 1) * f.PageSize)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// UsernameExists 判断用户名是否已存在（excludeID 用于修改时排除自身）。
func (r *UserRepository) UsernameExists(username string, excludeID uint) (bool, error) {
	q := r.db.Model(&model.User{}).Where("username = ?", username)
	if excludeID > 0 {
		q = q.Where("id <> ?", excludeID)
	}
	var count int64
	if err := q.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// Save 保存用户实体（更新）。
func (r *UserRepository) Save(user *model.User) error {
	return r.db.Save(user).Error
}

// Delete 软删除用户。
func (r *UserRepository) Delete(id uint) error {
	return deleteByID(r.db, &model.User{}, id)
}

// CountByRole 统计某角色的启用用户数（用于保护最后一名管理员）。
func (r *UserRepository) CountByRole(role model.Role, excludeID uint) (int64, error) {
	q := r.db.Model(&model.User{}).Where("role = ?", role)
	if excludeID > 0 {
		q = q.Where("id <> ?", excludeID)
	}
	var count int64
	if err := q.Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// DeptExists 判断院系是否存在。
func (r *UserRepository) DeptExists(id uint) (bool, error) {
	return existsByID(r.db, &model.Department{}, id)
}

// IsNotFound 判断是否为记录不存在错误。
func IsNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}
