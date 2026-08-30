package service

import (
	"strings"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/password"
	"github.com/wangyifeng2025/student-aid-system/pkg/validate"
	"gorm.io/gorm"
)

// StudentService 学生信息业务逻辑（含重点人群自动匹配）。
// 新增/导入学生时会自动创建登录账号（用户名=学号，角色=student，初始密码=Stu+身份证后6位），
// 并将 student.user_id 关联到该账号；更新时同步账号姓名/手机/院系/班级/用户名；
// 无认定/助学金申报时物理删除学籍与登录账号；已有申报则拒绝删除。
type StudentService struct {
	db       *gorm.DB
	repo     *repository.StudentRepository
	sgRepo   *repository.SpecialGroupRepository
	userRepo *repository.UserRepository
	orgRepo  *repository.OrgRepository
}

func NewStudentService(db *gorm.DB) *StudentService {
	return &StudentService{
		db:       db,
		repo:     repository.NewStudentRepository(db),
		sgRepo:   repository.NewSpecialGroupRepository(db),
		userRepo: repository.NewUserRepository(db),
		orgRepo:  repository.NewOrgRepository(db),
	}
}

func (s *StudentService) List(f repository.StudentFilter, actor rbac.Actor) (*dto.PageResult[dto.StudentResponse], error) {
	year := progressYear(f.Year)
	f.Year = year
	items, total, err := s.repo.ListStudents(f, actor)
	if err != nil {
		return nil, err
	}
	resps := dto.ToStudentResponses(items)
	if err := s.attachProgress(resps, items, year, actor.Role != model.RoleAdmin); err != nil {
		return nil, err
	}
	return &dto.PageResult[dto.StudentResponse]{
		Items:    resps,
		Total:    total,
		Page:     f.Page,
		PageSize: f.PageSize,
	}, nil
}

func (s *StudentService) Get(id uint, actor rbac.Actor, year int) (*dto.StudentResponse, error) {
	st, err := s.repo.FindStudent(id)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	var targetUserID uint
	if st.UserID != nil {
		targetUserID = *st.UserID
	}
	if !actor.CanAccessStudent(targetUserID, st.ClassID, st.DeptID) {
		return nil, ErrForbidden
	}
	resp := dto.ToStudentResponse(st)
	s.attachOrgNames(&resp, st)
	resps := []dto.StudentResponse{resp}
	if err := s.attachProgress(resps, []model.Student{*st}, progressYear(year), actor.Role != model.RoleAdmin); err != nil {
		return nil, err
	}
	return &resps[0], nil
}

// GetByUserID 学生本人按登录用户 ID 获取档案。
func (s *StudentService) GetByUserID(userID uint) (*dto.StudentResponse, error) {
	st, err := s.repo.FindByUserID(userID)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	resp := dto.ToStudentResponse(st)
	s.attachOrgNames(&resp, st)
	return &resp, nil
}

func (s *StudentService) attachOrgNames(resp *dto.StudentResponse, st *model.Student) {
	if resp == nil || st == nil {
		return
	}
	resp.DeptName, resp.ClassName = studentOrgNames(s.orgRepo, st)
}

func progressYear(year int) int {
	if year > 0 {
		return year
	}
	return time.Now().Year()
}

func maskIDCard(s string) string {
	if s == "" {
		return ""
	}
	if len(s) < 8 {
		return "****"
	}
	return s[:4] + "**********" + s[len(s)-4:]
}

func pickGrant(grants []model.GrantApplication) *model.GrantApplication {
	var fallback *model.GrantApplication
	for i := range grants {
		g := &grants[i]
		if g.GrantType == model.GrantNationalAid {
			return g
		}
		if fallback == nil {
			fallback = g
		}
	}
	return fallback
}

func (s *StudentService) attachProgress(resps []dto.StudentResponse, items []model.Student, year int, maskID bool) error {
	if len(resps) == 0 || len(resps) != len(items) {
		return nil
	}
	ids := make([]uint, len(items))
	for i := range items {
		ids[i] = items[i].ID
	}
	recs, err := s.repo.ListRecognitionsForYear(ids, year)
	if err != nil {
		return err
	}
	grants, err := s.repo.ListGrantsForYear(ids, year)
	if err != nil {
		return err
	}
	recByStu := make(map[uint]model.RecognitionApplication, len(recs))
	for i := range recs {
		recByStu[recs[i].StudentID] = recs[i]
	}
	grantsByStu := make(map[uint][]model.GrantApplication, len(grants))
	for i := range grants {
		sid := grants[i].StudentID
		grantsByStu[sid] = append(grantsByStu[sid], grants[i])
	}
	for i := range resps {
		resps[i].ProgressYear = year
		if r, ok := recByStu[items[i].ID]; ok {
			resps[i].RecognitionStatus = string(r.Status)
			resps[i].RecognitionID = r.ID
		}
		if g := pickGrant(grantsByStu[items[i].ID]); g != nil {
			resps[i].GrantStatus = string(g.Status)
			resps[i].GrantID = g.ID
		}
		if maskID {
			resps[i].IDCard = maskIDCard(resps[i].IDCard)
		}
	}
	return nil
}

// Create 新增学生：在事务中创建登录账号与学生档案，返回带初始密码的响应。
func (s *StudentService) Create(req *dto.StudentRequest) (*dto.StudentResponse, error) {
	if existing, err := s.findExistingForWrite(req); err != nil {
		return nil, err
	} else if existing != nil && existing.DeletedAt.Valid {
		if err := s.restoreStudent(existing); err != nil {
			return nil, err
		}
		return s.Update(existing.ID, req)
	}
	st := &model.Student{}
	if err := s.apply(st, req, 0); err != nil {
		return nil, err
	}
	var initialPwd string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var err error
		initialPwd, err = s.ensureUserForStudent(tx, st)
		if err != nil {
			return err
		}
		return repository.NewStudentRepository(tx).CreateStudent(st)
	})
	if err != nil {
		return nil, err
	}
	resp := dto.ToStudentResponse(st)
	resp.InitialPassword = initialPwd
	return &resp, nil
}

// Update 修改学生：同步关联账号的姓名/手机/院系/班级/用户名；若历史学生未建账号则补建。
func (s *StudentService) Update(id uint, req *dto.StudentRequest) (*dto.StudentResponse, error) {
	st, err := s.repo.FindStudent(id)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := s.apply(st, req, id); err != nil {
		return nil, err
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := repository.NewStudentRepository(tx).SaveStudent(st); err != nil {
			return err
		}
		_, err := s.ensureUserForStudent(tx, st)
		return err
	})
	if err != nil {
		return nil, err
	}
	resp := dto.ToStudentResponse(st)
	return &resp, nil
}

// Upsert 按学号/身份证增量导入（含软删复活）：已存在则更新，否则新增。
func (s *StudentService) Upsert(req *dto.StudentRequest) (created bool, err error) {
	existing, ferr := s.findExistingForWrite(req)
	if ferr != nil {
		return false, ferr
	}
	if existing != nil {
		if err := s.restoreStudent(existing); err != nil {
			return false, err
		}
		_, uerr := s.Update(existing.ID, req)
		return false, uerr
	}
	_, cerr := s.Create(req)
	return true, cerr
}

// Delete 无申报时物理删除学生及登录账号；已有认定/助学金申报则拒绝。
func (s *StudentService) Delete(id uint) error {
	st, err := s.repo.FindStudent(id)
	if err != nil {
		if repository.IsNotFound(err) {
			return ErrNotFound
		}
		return err
	}
	has, herr := s.repo.HasApplications(id)
	if herr != nil {
		return herr
	}
	if has {
		return CannotDelete("该学生已有认定或助学金申报，无法删除")
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := repository.NewStudentRepository(tx).DeleteStudent(id); err != nil {
			return err
		}
		if st.UserID != nil && *st.UserID > 0 {
			return tx.Unscoped().Delete(&model.User{}, *st.UserID).Error
		}
		return nil
	})
}

func (s *StudentService) findExistingForWrite(req *dto.StudentRequest) (*model.Student, error) {
	if req == nil {
		return nil, nil
	}
	if no := strings.TrimSpace(req.StudentNo); no != "" {
		st, err := s.repo.FindByStudentNoUnscoped(no)
		if err == nil {
			return st, nil
		}
		if !repository.IsNotFound(err) {
			return nil, err
		}
	}
	if card := strings.ToUpper(strings.TrimSpace(req.IDCard)); card != "" {
		st, err := s.repo.FindByIDCardUnscoped(card)
		if err == nil {
			return st, nil
		}
		if !repository.IsNotFound(err) {
			return nil, err
		}
	}
	return nil, nil
}

func (s *StudentService) restoreStudent(st *model.Student) error {
	if st == nil || !st.DeletedAt.Valid {
		return nil
	}
	if err := s.repo.Restore(st); err != nil {
		return err
	}
	if st.UserID == nil || *st.UserID == 0 {
		return nil
	}
	found, err := s.userRepo.Restore(*st.UserID)
	if err != nil {
		return err
	}
	if !found {
		st.UserID = nil
		return s.repo.SaveStudent(st)
	}
	return nil
}

// ExportList 导出用：按筛选条件返回全部学生（不分页）。
func (s *StudentService) ExportList(f repository.StudentFilter, actor rbac.Actor) ([]model.Student, error) {
	f.PageSize = 0
	items, _, err := s.repo.ListStudents(f, actor)
	return items, err
}

// ensureUserForStudent 在事务中维护学生关联的登录账号：
//   - 无关联账号：创建（用户名=学号，角色=student，初始密码=Stu+身份证后6位），返回初始密码
//   - 已有关联账号：同步姓名/手机/院系/用户名（学号变更时同步用户名），返回空密码
//   - 学号对应用户已软删：复活并挂回
func (s *StudentService) ensureUserForStudent(tx *gorm.DB, st *model.Student) (string, error) {
	users := repository.NewUserRepository(tx)
	if no := strings.TrimSpace(st.StudentNo); no != "" {
		u, err := users.FindByUsernameUnscoped(no)
		if err == nil {
			if u.Role != model.RoleStudent {
				return "", NewValidationError("登录账号「" + no + "」已存在，无法为学生自动创建账号")
			}
			if u.DeletedAt.Valid {
				if _, rerr := users.Restore(u.ID); rerr != nil {
					return "", rerr
				}
			}
			st.UserID = &u.ID
			return "", syncStudentUser(tx, u.ID, st)
		}
		if !repository.IsNotFound(err) {
			return "", err
		}
	}

	if st.UserID != nil && *st.UserID > 0 {
		u, err := users.FindByIDUnscoped(*st.UserID)
		if err == nil {
			if u.DeletedAt.Valid {
				if _, rerr := users.Restore(u.ID); rerr != nil {
					return "", rerr
				}
			}
			return "", syncStudentUser(tx, u.ID, st)
		}
		if !repository.IsNotFound(err) {
			return "", err
		}
		st.UserID = nil
	}

	pwd := defaultStudentPassword(st.IDCard)
	hash, err := password.Hash(pwd)
	if err != nil {
		return "", err
	}
	deptID := st.DeptID
	u := &model.User{
		Username:     st.StudentNo,
		PasswordHash: hash,
		RealName:     st.Name,
		Role:         model.RoleStudent,
		Phone:        st.Phone,
		DeptID:       &deptID,
		Status:       1,
	}
	if err := tx.Create(u).Error; err != nil {
		return "", err
	}
	st.UserID = &u.ID
	return pwd, nil
}

func syncStudentUser(tx *gorm.DB, userID uint, st *model.Student) error {
	updates := map[string]any{
		"real_name": st.Name,
		"phone":     st.Phone,
		"dept_id":   st.DeptID,
		"username":  st.StudentNo,
		"role":      model.RoleStudent,
	}
	return tx.Model(&model.User{}).Where("id = ?", userID).Updates(updates).Error
}

// defaultStudentPassword 生成初始密码：Stu + 身份证后 6 位；长度不足时回退固定值。
func defaultStudentPassword(idCard string) string {
	if len(idCard) >= 6 {
		return "Stu" + idCard[len(idCard)-6:]
	}
	return "Stu@12345"
}

// apply 校验请求并写入学生模型；excludeID>0 表示更新（学号查重排除自身）。
func (s *StudentService) apply(st *model.Student, req *dto.StudentRequest, excludeID uint) error {
	studentNo := strings.TrimSpace(req.StudentNo)
	if studentNo == "" {
		return NewValidationError("学号不能为空")
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return NewValidationError("姓名不能为空")
	}

	// 学号唯一
	exists, err := s.repo.StudentNoExists(studentNo, excludeID)
	if err != nil {
		return err
	}
	if exists {
		return NewValidationError("学号已存在")
	}

	// 性别（必填）
	gender := strings.TrimSpace(req.Gender)
	if gender == "" {
		return NewValidationError("性别不能为空")
	}
	if gender != "男" && gender != "女" {
		return NewValidationError("性别只能为“男”或“女”")
	}

	// 身份证（必填且唯一）/ 手机号
	idCard := strings.ToUpper(strings.TrimSpace(req.IDCard))
	if idCard == "" {
		return NewValidationError("身份证号不能为空")
	}
	if !validate.IDCard(idCard) {
		return NewValidationError("身份证号格式不正确（需为 18 位有效号码）")
	}
	idExists, err := s.repo.IDCardExists(idCard, excludeID)
	if err != nil {
		return err
	}
	if idExists {
		return NewValidationError("身份证号已存在")
	}
	phone := strings.TrimSpace(req.Phone)
	if phone != "" && !validate.Phone(phone) {
		return NewValidationError("手机号格式不正确")
	}

	// 字典约束：民族 / 政治面貌
	if err := s.requireDict("nation", req.Nation, "民族"); err != nil {
		return err
	}
	if err := s.requireDict("political_status", req.PoliticalStatus, "政治面貌"); err != nil {
		return err
	}

	// 组织机构外键（必填且须存在）
	if req.DeptID == 0 {
		return NewValidationError("所属院系不能为空")
	}
	if req.MajorID == 0 {
		return NewValidationError("所属专业不能为空")
	}
	if req.ClassID == 0 {
		return NewValidationError("所属班级不能为空")
	}
	if ok, err := s.repo.DeptExists(req.DeptID); err != nil {
		return err
	} else if !ok {
		return NewValidationError("所属院系不存在")
	}
	if ok, err := s.repo.MajorExists(req.MajorID); err != nil {
		return err
	} else if !ok {
		return NewValidationError("所属专业不存在")
	}
	if ok, err := s.repo.ClassExists(req.ClassID); err != nil {
		return err
	} else if !ok {
		return NewValidationError("所属班级不存在")
	}

	// 日期
	birth, err := parseOptionalDate(req.Birth, "出生年月")
	if err != nil {
		return err
	}
	enroll, err := parseOptionalDate(req.EnrollTime, "入学时间")
	if err != nil {
		return err
	}

	// 重点人群自动匹配
	isKey, err := s.sgRepo.MatchExists(studentNo, idCard)
	if err != nil {
		return err
	}

	st.StudentNo = studentNo
	st.Name = name
	st.Gender = gender
	st.Birth = birth
	st.Nation = strings.TrimSpace(req.Nation)
	st.PoliticalStatus = strings.TrimSpace(req.PoliticalStatus)
	st.IDCard = idCard
	st.Phone = phone
	st.EnrollTime = enroll
	st.DeptID = req.DeptID
	st.MajorID = req.MajorID
	st.ClassID = req.ClassID
	st.IsKeyGroup = isKey
	return nil
}

// requireDict 校验字典约束字段：非空时必须命中字典项。
func (s *StudentService) requireDict(dictType, code, label string) error {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil
	}
	ok, err := s.repo.DictExists(dictType, code)
	if err != nil {
		return err
	}
	if !ok {
		return NewValidationError(label + "取值无效（须为字典中的编码）")
	}
	return nil
}

// parseOptionalDate 解析可选日期字符串（YYYY-MM-DD），空字符串返回 nil。
func parseOptionalDate(s, label string) (*time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil
	}
	t, err := time.Parse(dto.DateLayout, s)
	if err != nil {
		return nil, NewValidationError(label + "日期格式不正确（应为 YYYY-MM-DD）")
	}
	return &t, nil
}
