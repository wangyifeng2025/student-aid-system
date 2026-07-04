package repository

import (
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"gorm.io/gorm"
)

// StudentRepository 学生信息数据访问。
type StudentRepository struct {
	db *gorm.DB
}

func NewStudentRepository(db *gorm.DB) *StudentRepository {
	return &StudentRepository{db: db}
}

// existsByID 判断任意模型是否存在该主键记录（软删除自动排除）。
func existsByID(db *gorm.DB, dest any, id uint) (bool, error) {
	if id == 0 {
		return false, nil
	}
	var count int64
	if err := db.Model(dest).Where("id = ?", id).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// StudentFilter 学生列表过滤与分页条件（0 值表示不过滤）。
type StudentFilter struct {
	DeptID     uint
	MajorID    uint
	ClassID    uint
	Keyword    string // 姓名/学号/身份证模糊匹配
	IsKeyGroup *bool
	Page       int
	PageSize   int
}

func (r *StudentRepository) query(f StudentFilter) *gorm.DB {
	q := r.db.Model(&model.Student{})
	if f.DeptID > 0 {
		q = q.Where("dept_id = ?", f.DeptID)
	}
	if f.MajorID > 0 {
		q = q.Where("major_id = ?", f.MajorID)
	}
	if f.ClassID > 0 {
		q = q.Where("class_id = ?", f.ClassID)
	}
	if f.IsKeyGroup != nil {
		q = q.Where("is_key_group = ?", *f.IsKeyGroup)
	}
	if f.Keyword != "" {
		kw := "%" + f.Keyword + "%"
		q = q.Where("name LIKE ? OR student_no LIKE ? OR id_card LIKE ?", kw, kw, kw)
	}
	return q
}

// ListStudents 分页列出学生，返回当前页数据与总条数。
func (r *StudentRepository) ListStudents(f StudentFilter) ([]model.Student, int64, error) {
	var total int64
	if err := r.query(f).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.Student
	q := r.query(f).Order("id desc")
	if f.PageSize > 0 {
		q = q.Limit(f.PageSize).Offset((f.Page - 1) * f.PageSize)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *StudentRepository) FindStudent(id uint) (*model.Student, error) {
	var s model.Student
	if err := r.db.First(&s, id).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *StudentRepository) FindByStudentNo(no string) (*model.Student, error) {
	var s model.Student
	if err := r.db.Where("student_no = ?", no).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

// FindByUserID 按关联用户 ID 查找学生（用于学生本人解析自身档案）。
func (r *StudentRepository) FindByUserID(userID uint) (*model.Student, error) {
	var s model.Student
	if err := r.db.Where("user_id = ?", userID).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

// FindMapByIDs 批量按 ID 加载学生，返回 id->学生 映射（用于列表渲染学号/姓名）。
func (r *StudentRepository) FindMapByIDs(ids []uint) (map[uint]model.Student, error) {
	out := make(map[uint]model.Student, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	var items []model.Student
	if err := r.db.Where("id IN ?", ids).Find(&items).Error; err != nil {
		return nil, err
	}
	for i := range items {
		out[items[i].ID] = items[i]
	}
	return out, nil
}

func (r *StudentRepository) CreateStudent(s *model.Student) error {
	return r.db.Create(s).Error
}

func (r *StudentRepository) SaveStudent(s *model.Student) error {
	return r.db.Save(s).Error
}

func (r *StudentRepository) DeleteStudent(id uint) error {
	return deleteByID(r.db, &model.Student{}, id)
}

// StudentNoExists 判断学号是否已存在（excludeID 用于修改时排除自身）。
func (r *StudentRepository) StudentNoExists(no string, excludeID uint) (bool, error) {
	var count int64
	q := r.db.Model(&model.Student{}).Where("student_no = ?", no)
	if excludeID > 0 {
		q = q.Where("id <> ?", excludeID)
	}
	if err := q.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// IDCardExists 判断身份证号是否已存在（excludeID 用于修改时排除自身）。
func (r *StudentRepository) IDCardExists(idCard string, excludeID uint) (bool, error) {
	if idCard == "" {
		return false, nil
	}
	var count int64
	q := r.db.Model(&model.Student{}).Where("id_card = ?", idCard)
	if excludeID > 0 {
		q = q.Where("id <> ?", excludeID)
	}
	if err := q.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *StudentRepository) ClassExists(id uint) (bool, error) {
	return existsByID(r.db, &model.Class{}, id)
}

func (r *StudentRepository) DeptExists(id uint) (bool, error) {
	return existsByID(r.db, &model.Department{}, id)
}

func (r *StudentRepository) MajorExists(id uint) (bool, error) {
	return existsByID(r.db, &model.Major{}, id)
}

// DictExists 判断字典项 (type, code) 是否存在（用于民族/政治面貌等下拉约束）。
func (r *StudentRepository) DictExists(dictType, code string) (bool, error) {
	var count int64
	err := r.db.Model(&model.Dict{}).
		Where("type = ? AND code = ?", dictType, code).
		Count(&count).Error
	return count > 0, err
}

// SetKeyGroupByIdentity 将匹配指定学号/身份证的学生 is_key_group 置为目标值。
// studentNo 与 idCard 为空的条件不参与匹配，避免误伤空值。
func (r *StudentRepository) SetKeyGroupByIdentity(studentNo, idCard string, value bool) error {
	if studentNo == "" && idCard == "" {
		return nil
	}
	q := r.db.Model(&model.Student{})
	switch {
	case studentNo != "" && idCard != "":
		q = q.Where("student_no = ? OR id_card = ?", studentNo, idCard)
	case studentNo != "":
		q = q.Where("student_no = ?", studentNo)
	default:
		q = q.Where("id_card = ?", idCard)
	}
	return q.Update("is_key_group", value).Error
}
