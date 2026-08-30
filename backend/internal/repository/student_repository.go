package repository

import (
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
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
	DeptID            uint
	MajorID           uint
	ClassID           uint
	Keyword           string // 姓名/学号/身份证模糊匹配
	IsKeyGroup        *bool
	Year              int    // 认定/助学金学年，0 表示当前年
	RecognitionStatus string // 空=不限；none=未提交；其余为认定状态
	Page              int
	PageSize          int
}

func (r *StudentRepository) query(f StudentFilter, actor rbac.Actor) *gorm.DB {
	q := r.db.Model(&model.Student{}).Scopes(rbac.ApplyStudentScope(actor))
	if f.DeptID > 0 {
		q = q.Where("students.dept_id = ?", f.DeptID)
	}
	if f.MajorID > 0 {
		q = q.Where("students.major_id = ?", f.MajorID)
	}
	if f.ClassID > 0 {
		q = q.Where("students.class_id = ?", f.ClassID)
	}
	if f.IsKeyGroup != nil {
		q = q.Where("students.is_key_group = ?", *f.IsKeyGroup)
	}
	if f.Keyword != "" {
		kw := "%" + f.Keyword + "%"
		q = q.Where("students.name LIKE ? OR students.student_no LIKE ? OR students.id_card LIKE ?", kw, kw, kw)
	}
	if st := f.RecognitionStatus; st != "" {
		year := f.Year
		if year <= 0 {
			year = time.Now().Year()
		}
		q = q.Joins("LEFT JOIN recognition_applications ra ON ra.student_id = students.id AND ra.year = ? AND ra.deleted_at IS NULL", year)
		if st == "none" {
			q = q.Where("ra.id IS NULL")
		} else {
			q = q.Where("ra.status = ?", st)
		}
	}
	return q
}

// ListStudents 分页列出学生（按操作者数据范围），返回当前页数据与总条数。
func (r *StudentRepository) ListStudents(f StudentFilter, actor rbac.Actor) ([]model.Student, int64, error) {
	var total int64
	if err := r.query(f, actor).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.Student
	q := r.query(f, actor).Select("students.*").Order("students.id desc")
	if f.PageSize > 0 {
		q = q.Limit(f.PageSize).Offset((f.Page - 1) * f.PageSize)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// ListRecognitionsForYear 批量取指定学年的认定申请（每个学生通常至多一条）。
func (r *StudentRepository) ListRecognitionsForYear(studentIDs []uint, year int) ([]model.RecognitionApplication, error) {
	if len(studentIDs) == 0 {
		return nil, nil
	}
	var items []model.RecognitionApplication
	err := r.db.Where("student_id IN ? AND year = ?", studentIDs, year).Find(&items).Error
	return items, err
}

// ListGrantsForYear 批量取指定学年的助学金申请（一年可能多笔，调用方择优）。
func (r *StudentRepository) ListGrantsForYear(studentIDs []uint, year int) ([]model.GrantApplication, error) {
	if len(studentIDs) == 0 {
		return nil, nil
	}
	var items []model.GrantApplication
	err := r.db.Where("student_id IN ? AND year = ?", studentIDs, year).Order("id desc").Find(&items).Error
	return items, err
}

func (r *StudentRepository) FindStudent(id uint) (*model.Student, error) {
	var s model.Student
	if err := r.db.First(&s, id).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

// FindStudentUnscoped 按 ID 加载学生，含已软删除记录（申报记录备查展示学号/姓名）。
func (r *StudentRepository) FindStudentUnscoped(id uint) (*model.Student, error) {
	var s model.Student
	if err := r.db.Unscoped().First(&s, id).Error; err != nil {
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

func (r *StudentRepository) FindByStudentNoUnscoped(no string) (*model.Student, error) {
	var s model.Student
	if err := r.db.Unscoped().Where("student_no = ?", no).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *StudentRepository) FindByIDCardUnscoped(idCard string) (*model.Student, error) {
	var s model.Student
	if err := r.db.Unscoped().Where("id_card = ?", idCard).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *StudentRepository) Restore(s *model.Student) error {
	if s == nil || s.ID == 0 {
		return gorm.ErrRecordNotFound
	}
	s.DeletedAt = gorm.DeletedAt{}
	return r.db.Unscoped().Save(s).Error
}

func (r *StudentRepository) HasApplications(studentID uint) (bool, error) {
	if studentID == 0 {
		return false, nil
	}
	var n int64
	if err := r.db.Model(&model.RecognitionApplication{}).Where("student_id = ?", studentID).Count(&n).Error; err != nil {
		return false, err
	}
	if n > 0 {
		return true, nil
	}
	if err := r.db.Model(&model.GrantApplication{}).Where("student_id = ?", studentID).Count(&n).Error; err != nil {
		return false, err
	}
	return n > 0, nil
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
	// 含已软删除学生：删除学籍后申报记录仍需展示学号/姓名备查。
	if err := r.db.Unscoped().Where("id IN ?", ids).Find(&items).Error; err != nil {
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
	return hardDeleteByID(r.db, &model.Student{}, id)
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
