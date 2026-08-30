package repository

import (
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"gorm.io/gorm"
)

// OrgRepository 组织机构（院系/专业/年级/班级）数据访问。
type OrgRepository struct {
	db *gorm.DB
}

func NewOrgRepository(db *gorm.DB) *OrgRepository {
	return &OrgRepository{db: db}
}

// exists 判断指定模型是否存在该主键记录（软删除自动排除）。
func (r *OrgRepository) exists(dest any, id uint) (bool, error) {
	var count int64
	if err := r.db.Model(dest).Where("id = ?", id).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func deleteByID(db *gorm.DB, dest any, id uint) error {
	result := db.Delete(dest, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ===== 院系 Department =====

func (r *OrgRepository) ListDepartments() ([]model.Department, error) {
	var items []model.Department
	err := r.db.Order("id").Find(&items).Error
	return items, err
}

func (r *OrgRepository) FindDepartment(id uint) (*model.Department, error) {
	var d model.Department
	if err := r.db.First(&d, id).Error; err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *OrgRepository) CreateDepartment(d *model.Department) error {
	return r.db.Create(d).Error
}

func (r *OrgRepository) SaveDepartment(d *model.Department) error {
	return r.db.Save(d).Error
}

func (r *OrgRepository) DeleteDepartment(id uint) error {
	return deleteByID(r.db, &model.Department{}, id)
}

// DepartmentCodeExists 判断院系编码是否已存在（excludeID 用于修改时排除自身）。
func (r *OrgRepository) DepartmentCodeExists(code string, excludeID uint) (bool, error) {
	var count int64
	q := r.db.Model(&model.Department{}).Where("code = ?", code)
	if excludeID > 0 {
		q = q.Where("id <> ?", excludeID)
	}
	if err := q.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// FindDepartmentByCode 按院系编码查找（code 须非空）。
func (r *OrgRepository) FindDepartmentByCode(code string) (*model.Department, error) {
	var d model.Department
	if err := r.db.Where("code = ?", code).First(&d).Error; err != nil {
		return nil, err
	}
	return &d, nil
}

// FindDepartmentByName 按院系名称查找。
func (r *OrgRepository) FindDepartmentByName(name string) (*model.Department, error) {
	var d model.Department
	if err := r.db.Where("name = ?", name).First(&d).Error; err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *OrgRepository) CountMajorsByDept(deptID uint) (int64, error) {
	var count int64
	err := r.db.Model(&model.Major{}).Where("dept_id = ?", deptID).Count(&count).Error
	return count, err
}

func (r *OrgRepository) CountClassesByDept(deptID uint) (int64, error) {
	var count int64
	err := r.db.Model(&model.Class{}).Where("dept_id = ?", deptID).Count(&count).Error
	return count, err
}

// ===== 专业 Major =====

// ListMajors 列出专业；deptID > 0 时按院系过滤。
func (r *OrgRepository) ListMajors(deptID uint) ([]model.Major, error) {
	var items []model.Major
	q := r.db.Order("id")
	if deptID > 0 {
		q = q.Where("dept_id = ?", deptID)
	}
	err := q.Find(&items).Error
	return items, err
}

func (r *OrgRepository) FindMajor(id uint) (*model.Major, error) {
	var m model.Major
	if err := r.db.First(&m, id).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *OrgRepository) CreateMajor(m *model.Major) error {
	return r.db.Create(m).Error
}

func (r *OrgRepository) SaveMajor(m *model.Major) error {
	return r.db.Save(m).Error
}

func (r *OrgRepository) DeleteMajor(id uint) error {
	return deleteByID(r.db, &model.Major{}, id)
}

func (r *OrgRepository) DepartmentExists(id uint) (bool, error) {
	return r.exists(&model.Department{}, id)
}

func (r *OrgRepository) CountClassesByMajor(majorID uint) (int64, error) {
	var count int64
	err := r.db.Model(&model.Class{}).Where("major_id = ?", majorID).Count(&count).Error
	return count, err
}

// FindMajorByDeptAndCode 按院系 + 专业编码查找。
func (r *OrgRepository) FindMajorByDeptAndCode(deptID uint, code string) (*model.Major, error) {
	var m model.Major
	if err := r.db.Where("dept_id = ? AND code = ?", deptID, code).First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

// FindMajorByDeptAndName 按院系 + 专业名称查找。
func (r *OrgRepository) FindMajorByDeptAndName(deptID uint, name string) (*model.Major, error) {
	var m model.Major
	if err := r.db.Where("dept_id = ? AND name = ?", deptID, name).First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

// ===== 年级 Grade =====

func (r *OrgRepository) ListGrades() ([]model.Grade, error) {
	var items []model.Grade
	err := r.db.Order("year desc, id").Find(&items).Error
	return items, err
}

func (r *OrgRepository) FindGrade(id uint) (*model.Grade, error) {
	var g model.Grade
	if err := r.db.First(&g, id).Error; err != nil {
		return nil, err
	}
	return &g, nil
}

func (r *OrgRepository) CreateGrade(g *model.Grade) error {
	return r.db.Create(g).Error
}

func (r *OrgRepository) SaveGrade(g *model.Grade) error {
	return r.db.Save(g).Error
}

func (r *OrgRepository) DeleteGrade(id uint) error {
	return deleteByID(r.db, &model.Grade{}, id)
}

// FindGradeByYear 按入学年份查找年级。
func (r *OrgRepository) FindGradeByYear(year int) (*model.Grade, error) {
	var g model.Grade
	if err := r.db.Where("year = ?", year).First(&g).Error; err != nil {
		return nil, err
	}
	return &g, nil
}

// FindGradeByName 按年级名称查找。
func (r *OrgRepository) FindGradeByName(name string) (*model.Grade, error) {
	var g model.Grade
	if err := r.db.Where("name = ?", name).First(&g).Error; err != nil {
		return nil, err
	}
	return &g, nil
}

func (r *OrgRepository) CountClassesByGrade(gradeID uint) (int64, error) {
	var count int64
	err := r.db.Model(&model.Class{}).Where("grade_id = ?", gradeID).Count(&count).Error
	return count, err
}

// ===== 班级 Class =====

// ClassFilter 班级列表过滤条件（0 值表示不过滤）。
type ClassFilter struct {
	DeptID  uint
	MajorID uint
	GradeID uint
}

func (r *OrgRepository) ListClasses(f ClassFilter) ([]model.Class, error) {
	var items []model.Class
	q := r.db.Order("id")
	if f.DeptID > 0 {
		q = q.Where("dept_id = ?", f.DeptID)
	}
	if f.MajorID > 0 {
		q = q.Where("major_id = ?", f.MajorID)
	}
	if f.GradeID > 0 {
		q = q.Where("grade_id = ?", f.GradeID)
	}
	err := q.Find(&items).Error
	return items, err
}

func (r *OrgRepository) FindClass(id uint) (*model.Class, error) {
	var c model.Class
	if err := r.db.First(&c, id).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *OrgRepository) CreateClass(c *model.Class) error {
	return r.db.Create(c).Error
}

func (r *OrgRepository) SaveClass(c *model.Class) error {
	return r.db.Save(c).Error
}

func (r *OrgRepository) DeleteClass(id uint) error {
	return deleteByID(r.db, &model.Class{}, id)
}

// FindClassByDeptAndName 按院系 + 班级名称查找。
func (r *OrgRepository) FindClassByDeptAndName(deptID uint, name string) (*model.Class, error) {
	var c model.Class
	if err := r.db.Where("dept_id = ? AND name = ?", deptID, name).First(&c).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *OrgRepository) MajorExists(id uint) (bool, error) {
	return r.exists(&model.Major{}, id)
}

func (r *OrgRepository) GradeExists(id uint) (bool, error) {
	return r.exists(&model.Grade{}, id)
}

func (r *OrgRepository) UserExists(id uint) (bool, error) {
	return r.exists(&model.User{}, id)
}

// FindUserByUsername 按登录用户名查找用户（用于班级导入解析班主任）。
func (r *OrgRepository) FindUserByUsername(username string) (*model.User, error) {
	var u model.User
	if err := r.db.Where("username = ?", username).First(&u).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *OrgRepository) CountStudentsByClass(classID uint) (int64, error) {
	var count int64
	err := r.db.Model(&model.Student{}).Where("class_id = ?", classID).Count(&count).Error
	return count, err
}
