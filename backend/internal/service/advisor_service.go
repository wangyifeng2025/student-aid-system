package service

import (
	"fmt"
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/password"
	"github.com/wangyifeng2025/student-aid-system/pkg/validate"
	"gorm.io/gorm"
)

// AdvisorService 班主任信息管理（仅管理员）。
type AdvisorService struct {
	repo    *repository.AdvisorRepository
	org     *repository.OrgRepository
	user    *repository.UserRepository
	userSvc *UserService
}

func NewAdvisorService(db *gorm.DB) *AdvisorService {
	return &AdvisorService{
		repo:    repository.NewAdvisorRepository(db),
		org:     repository.NewOrgRepository(db),
		user:    repository.NewUserRepository(db),
		userSvc: NewUserService(db),
	}
}

func (s *AdvisorService) List(f repository.AdvisorFilter) (*dto.PageResult[dto.AdvisorResponse], error) {
	items, total, err := s.repo.List(f)
	if err != nil {
		return nil, err
	}
	out, err := s.toResponses(items)
	if err != nil {
		return nil, err
	}
	return &dto.PageResult[dto.AdvisorResponse]{
		Items: out, Total: total, Page: f.Page, PageSize: f.PageSize,
	}, nil
}

func (s *AdvisorService) Get(id uint) (*dto.AdvisorResponse, error) {
	a, err := s.repo.FindByID(id)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	out, err := s.toResponses([]model.Advisor{*a})
	if err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, ErrNotFound
	}
	return &out[0], nil
}

func (s *AdvisorService) Create(req *dto.AdvisorRequest) (*dto.AdvisorResponse, error) {
	if req != nil {
		if existing, err := s.repo.FindByStaffNoUnscoped(strings.TrimSpace(req.StaffNo)); err == nil && existing.DeletedAt.Valid {
			if err := s.restoreAdvisor(existing); err != nil {
				return nil, err
			}
			resp, uerr := s.Update(existing.ID, req)
			if uerr != nil {
				return nil, uerr
			}
			if saved, ferr := s.repo.FindByID(existing.ID); ferr == nil {
				if pwd, perr := s.applyInitialLoginPassword(saved); perr == nil {
					resp.InitialPassword = pwd
				}
			}
			return resp, nil
		} else if err != nil && !repository.IsNotFound(err) {
			return nil, err
		}
	}
	a := &model.Advisor{}
	if err := s.applyFields(a, req); err != nil {
		return nil, err
	}
	if err := s.repo.Create(a); err != nil {
		return nil, err
	}
	ids := uniqUints(req.ClassIDs)
	if err := s.replaceManagedClasses(a, nil, ids); err != nil {
		return nil, err
	}
	initial, err := s.ensureLoginUser(a, ids)
	if err != nil {
		return nil, err
	}
	resp, err := s.Get(a.ID)
	if err != nil {
		return nil, err
	}
	resp.InitialPassword = initial
	return resp, nil
}

func (s *AdvisorService) Update(id uint, req *dto.AdvisorRequest) (*dto.AdvisorResponse, error) {
	a, err := s.repo.FindByID(id)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := s.applyFields(a, req); err != nil {
		return nil, err
	}
	if err := s.repo.Save(a); err != nil {
		return nil, err
	}
	oldIDs, err := s.repo.ListClassIDs(a.ID)
	if err != nil {
		return nil, err
	}
	ids := uniqUints(req.ClassIDs)
	if err := s.replaceManagedClasses(a, oldIDs, ids); err != nil {
		return nil, err
	}
	if _, err := s.ensureLoginUser(a, ids); err != nil {
		return nil, err
	}
	return s.Get(a.ID)
}

func (s *AdvisorService) Delete(id uint) error {
	a, err := s.repo.FindByID(id)
	if repository.IsNotFound(err) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if a.UserID != nil && *a.UserID > 0 {
		has, herr := s.repo.ReviewerHasRecords(*a.UserID)
		if herr != nil {
			return herr
		}
		if has {
			return CannotDelete("该班主任已有评审记录，无法删除")
		}
	}
	return s.repo.Delete(a)
}

func (s *AdvisorService) replaceManagedClasses(a *model.Advisor, oldIDs, classIDs []uint) error {
	if err := s.repo.ReplaceClasses(a.ID, classIDs); err != nil {
		return err
	}
	for _, cid := range classIDs {
		if err := s.repo.KeepOnlyAdvisorForClass(a.ID, cid); err != nil {
			return err
		}
	}
	if a.UserID != nil {
		s.clearClassAdvisorIfOwned(diffUints(oldIDs, classIDs), *a.UserID)
	}
	return nil
}

func (s *AdvisorService) clearClassAdvisorIfOwned(classIDs []uint, userID uint) {
	for _, id := range classIDs {
		c, err := s.org.FindClass(id)
		if err != nil {
			continue
		}
		if c.AdvisorID != nil && *c.AdvisorID == userID {
			c.AdvisorID = nil
			_ = s.org.SaveClass(c)
		}
	}
}

func diffUints(old, keep []uint) []uint {
	set := map[uint]struct{}{}
	for _, id := range keep {
		set[id] = struct{}{}
	}
	out := make([]uint, 0)
	for _, id := range old {
		if _, ok := set[id]; !ok {
			out = append(out, id)
		}
	}
	return out
}

func (s *AdvisorService) applyFields(a *model.Advisor, req *dto.AdvisorRequest) error {
	if req == nil {
		return NewValidationError("参数不能为空")
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return NewValidationError("姓名不能为空")
	}
	staffNo := strings.TrimSpace(req.StaffNo)
	if staffNo == "" {
		return NewValidationError("教工号不能为空")
	}
	dup, err := s.repo.StaffNoExists(staffNo, a.ID)
	if err != nil {
		return err
	}
	if dup {
		return NewValidationError("教工号已存在")
	}
	if req.DeptID == 0 {
		return NewValidationError("请选择系部")
	}
	ok, err := s.org.DepartmentExists(req.DeptID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidRef
	}
	phone := strings.TrimSpace(req.Phone)
	if phone != "" && !validate.Phone(phone) {
		return NewValidationError("手机号格式不正确")
	}
	if err := s.validateClasses(req.DeptID, req.ClassIDs); err != nil {
		return err
	}
	a.DeptID = req.DeptID
	a.StaffNo = staffNo
	a.Name = name
	a.Phone = phone
	return nil
}

func (s *AdvisorService) validateClasses(deptID uint, classIDs []uint) error {
	for _, id := range uniqUints(classIDs) {
		c, err := s.org.FindClass(id)
		if repository.IsNotFound(err) {
			return NewValidationError("班级不存在")
		}
		if err != nil {
			return err
		}
		if c.DeptID != deptID {
			return NewValidationError("管理班级必须属于所选系部")
		}
	}
	return nil
}

// BindClass 将班级划给班主任并保证登录账号存在（班级导入/维护时同步数据范围）。
func (s *AdvisorService) BindClass(a *model.Advisor, classID uint) error {
	if a == nil || classID == 0 {
		return nil
	}
	if err := s.repo.AssignClass(a.ID, classID); err != nil {
		return err
	}
	ids, err := s.repo.ListClassIDs(a.ID)
	if err != nil {
		return err
	}
	_, err = s.ensureLoginUser(a, ids)
	return err
}

// ensureLoginUser 保证班主任有 classadvisor 登录账号（班级范围以名册为准，不写 users.class_id）。
func (s *AdvisorService) ensureLoginUser(a *model.Advisor, classIDs []uint) (string, error) {
	u, err := s.resolveAdvisorLoginUser(a)
	if err != nil {
		return "", err
	}
	if u != nil {
		if err := s.syncLinkedUser(u, a); err != nil {
			return "", err
		}
		uid := u.ID
		a.UserID = &uid
		if err := s.repo.Save(a); err != nil {
			return "", err
		}
		s.syncClassAdvisorIDs(u.ID, classIDs)
		return "", nil
	}

	username := advisorUsername(a)
	plain := advisorInitialPassword(a.Phone)
	hash, err := password.Hash(plain)
	if err != nil {
		return "", err
	}
	dept := a.DeptID
	created := &model.User{
		Username:     username,
		PasswordHash: hash,
		RealName:     a.Name,
		Role:         model.RoleClassAdvisor,
		Phone:        a.Phone,
		DeptID:       &dept,
		Status:       1,
	}
	if err := s.user.Create(created); err != nil {
		return "", err
	}
	uid := created.ID
	a.UserID = &uid
	if err := s.repo.Save(a); err != nil {
		return "", err
	}
	s.syncClassAdvisorIDs(created.ID, classIDs)
	return plain, nil
}

func (s *AdvisorService) resolveAdvisorLoginUser(a *model.Advisor) (*model.User, error) {
	if a.StaffNo != "" {
		u, err := s.restoreAdvisorUserByUsername(a.StaffNo)
		if err != nil || u != nil {
			return u, err
		}
	}
	if a.UserID != nil && *a.UserID > 0 {
		u, err := s.user.FindByIDUnscoped(*a.UserID)
		if err == nil {
			if u.DeletedAt.Valid {
				if _, rerr := s.user.Restore(u.ID); rerr != nil {
					return nil, rerr
				}
				u.DeletedAt = gorm.DeletedAt{}
			}
			return u, nil
		}
		if !repository.IsNotFound(err) {
			return nil, err
		}
	}
	if a.Phone != "" && a.Phone != a.StaffNo {
		return s.restoreAdvisorUserByUsername(a.Phone)
	}
	return nil, nil
}

func (s *AdvisorService) restoreAdvisorUserByUsername(username string) (*model.User, error) {
	u, err := s.user.FindByUsernameUnscoped(username)
	if repository.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if u.Role != model.RoleClassAdvisor {
		return nil, NewValidationError("教工号已被其他账号使用")
	}
	if u.DeletedAt.Valid {
		if _, err := s.user.Restore(u.ID); err != nil {
			return nil, err
		}
		u.DeletedAt = gorm.DeletedAt{}
	}
	return u, nil
}

func (s *AdvisorService) syncLinkedUser(u *model.User, a *model.Advisor) error {
	if a.StaffNo != "" && u.Username != a.StaffNo {
		taken, err := s.user.FindByUsernameUnscoped(a.StaffNo)
		if err == nil && taken.ID != u.ID {
			return NewValidationError("教工号已被其他账号使用")
		}
		if err != nil && !repository.IsNotFound(err) {
			return err
		}
		u.Username = a.StaffNo
	}
	u.RealName = a.Name
	u.Phone = a.Phone
	dept := a.DeptID
	u.DeptID = &dept
	u.Role = model.RoleClassAdvisor
	return s.user.Save(u)
}

func (s *AdvisorService) syncClassAdvisorIDs(userID uint, classIDs []uint) {
	for _, id := range classIDs {
		c, err := s.org.FindClass(id)
		if err != nil {
			continue
		}
		if c.AdvisorID != nil && *c.AdvisorID == userID {
			continue
		}
		uid := userID
		c.AdvisorID = &uid
		_ = s.org.SaveClass(c)
	}
}

func (s *AdvisorService) toResponses(items []model.Advisor) ([]dto.AdvisorResponse, error) {
	ids := make([]uint, 0, len(items))
	userIDs := make([]uint, 0, len(items))
	for i := range items {
		ids = append(ids, items[i].ID)
		if items[i].UserID != nil {
			userIDs = append(userIDs, *items[i].UserID)
		}
	}
	classMap, err := s.repo.ListClassIDsByAdvisorIDs(ids)
	if err != nil {
		return nil, err
	}
	var allClassIDs []uint
	for _, cs := range classMap {
		allClassIDs = append(allClassIDs, cs...)
	}
	classNames := map[uint]string{}
	if len(allClassIDs) > 0 {
		classes, err := s.org.ListClasses(repository.ClassFilter{})
		if err != nil {
			return nil, err
		}
		for i := range classes {
			classNames[classes[i].ID] = classes[i].Name
		}
	}
	deptNames := map[uint]string{}
	depts, err := s.org.ListDepartments()
	if err != nil {
		return nil, err
	}
	for i := range depts {
		deptNames[depts[i].ID] = depts[i].Name
	}
	usernames, err := s.user.FindUsernamesByIDs(userIDs)
	if err != nil {
		return nil, err
	}

	out := make([]dto.AdvisorResponse, 0, len(items))
	for i := range items {
		a := items[i]
		cls := make([]dto.AdvisorClassItem, 0)
		for _, cid := range classMap[a.ID] {
			cls = append(cls, dto.AdvisorClassItem{ID: cid, Name: classNames[cid]})
		}
		resp := dto.AdvisorResponse{
			ID:       a.ID,
			DeptID:   a.DeptID,
			DeptName: deptNames[a.DeptID],
			StaffNo:  a.StaffNo,
			Name:     a.Name,
			Phone:    a.Phone,
			UserID:   a.UserID,
			Classes:  cls,
		}
		if a.UserID != nil {
			resp.Username = usernames[*a.UserID]
		}
		out = append(out, resp)
	}
	return out, nil
}

func advisorUsername(a *model.Advisor) string {
	if s := strings.TrimSpace(a.StaffNo); s != "" {
		return s
	}
	if validate.Phone(a.Phone) {
		return a.Phone
	}
	if a.ID > 0 {
		return fmt.Sprintf("adv%d", a.ID)
	}
	return "advisor"
}

func advisorInitialPassword(phone string) string {
	digits := digitsOnly(phone)
	if len(digits) >= 6 {
		return "Adv" + digits[len(digits)-6:]
	}
	return "Adv123456"
}

func digitsOnly(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func (s *AdvisorService) applyInitialLoginPassword(a *model.Advisor) (string, error) {
	if a == nil || a.UserID == nil || *a.UserID == 0 {
		return "", nil
	}
	plain := advisorInitialPassword(a.Phone)
	hash, err := password.Hash(plain)
	if err != nil {
		return "", err
	}
	if err := s.user.UpdatePassword(*a.UserID, hash); err != nil {
		return "", err
	}
	return plain, nil
}

func uniqUints(ids []uint) []uint {
	seen := map[uint]struct{}{}
	out := make([]uint, 0, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

// ResolveExistingClass 按系部解析已有班级（班级须先在班级管理中创建）。
func (s *AdvisorService) ResolveExistingClass(deptID uint, className string) (*model.Class, error) {
	className = strings.TrimSpace(className)
	if className == "" {
		return nil, NewValidationError("班级名称不能为空")
	}
	existing, err := s.org.FindClassByDeptAndName(deptID, className)
	if repository.IsNotFound(err) {
		return nil, NewValidationError("班级不存在，请先在班级管理中创建：" + className)
	}
	return existing, err
}

func (s *AdvisorService) ResolveDepartment(nameOrCode string) (*model.Department, error) {
	nameOrCode = strings.TrimSpace(nameOrCode)
	if nameOrCode == "" {
		return nil, NewValidationError("系部不能为空")
	}
	if d, err := s.org.FindDepartmentByName(nameOrCode); err == nil {
		return d, nil
	} else if !repository.IsNotFound(err) {
		return nil, err
	}
	if d, err := s.org.FindDepartmentByCode(nameOrCode); err == nil {
		return d, nil
	} else if !repository.IsNotFound(err) {
		return nil, err
	}
	return nil, NewValidationError("系部不存在：" + nameOrCode)
}

func (s *AdvisorService) UpsertImported(deptID uint, staffNo, name, phone string, classIDs []uint) error {
	staffNo = strings.TrimSpace(staffNo)
	name = strings.TrimSpace(name)
	phone = strings.TrimSpace(phone)
	if staffNo == "" {
		return NewValidationError("教工号不能为空")
	}
	existing, err := s.repo.FindByStaffNoUnscoped(staffNo)
	if err != nil && !repository.IsNotFound(err) {
		return err
	}
	req := &dto.AdvisorRequest{DeptID: deptID, StaffNo: staffNo, Name: name, Phone: phone, ClassIDs: classIDs}
	var id uint
	if existing != nil {
		if err := s.restoreAdvisor(existing); err != nil {
			return err
		}
		old, _ := s.repo.ListClassIDs(existing.ID)
		req.ClassIDs = uniqUints(append(old, classIDs...))
		if _, err = s.Update(existing.ID, req); err != nil {
			return err
		}
		id = existing.ID
	} else {
		created, cerr := s.Create(req)
		if cerr != nil {
			return cerr
		}
		id = created.ID
	}
	saved, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}
	_, err = s.applyInitialLoginPassword(saved)
	return err
}

func (s *AdvisorService) restoreAdvisor(a *model.Advisor) error {
	if a == nil || !a.DeletedAt.Valid {
		return nil
	}
	if err := s.repo.Restore(a); err != nil {
		return err
	}
	if a.UserID == nil || *a.UserID == 0 {
		return nil
	}
	found, err := s.user.Restore(*a.UserID)
	if err != nil {
		return err
	}
	if !found {
		a.UserID = nil
		return s.repo.Save(a)
	}
	return nil
}
