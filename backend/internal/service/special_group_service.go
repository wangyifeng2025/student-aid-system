package service

import (
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"github.com/wangyifeng2025/student-aid-system/pkg/validate"
	"gorm.io/gorm"
)

// SpecialGroupService 重点保障人群名单业务逻辑。
// 名单变更后会重算被影响学生的 is_key_group 标记，保持匹配一致。
type SpecialGroupService struct {
	repo    *repository.SpecialGroupRepository
	stuRepo *repository.StudentRepository
}

func NewSpecialGroupService(db *gorm.DB) *SpecialGroupService {
	return &SpecialGroupService{
		repo:    repository.NewSpecialGroupRepository(db),
		stuRepo: repository.NewStudentRepository(db),
	}
}

func (s *SpecialGroupService) List(f repository.SpecialGroupFilter) (*dto.PageResult[dto.SpecialGroupResponse], error) {
	items, total, err := s.repo.List(f)
	if err != nil {
		return nil, err
	}
	return &dto.PageResult[dto.SpecialGroupResponse]{
		Items:    dto.ToSpecialGroupResponses(items),
		Total:    total,
		Page:     f.Page,
		PageSize: f.PageSize,
	}, nil
}

func (s *SpecialGroupService) Get(id uint) (*dto.SpecialGroupResponse, error) {
	sg, err := s.repo.Find(id)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	resp := dto.ToSpecialGroupResponse(sg)
	return &resp, nil
}

func (s *SpecialGroupService) Create(req *dto.SpecialGroupRequest) (*dto.SpecialGroupResponse, error) {
	sg := &model.SpecialGroup{}
	if err := applySpecialGroup(sg, req); err != nil {
		return nil, err
	}
	if err := s.repo.Create(sg); err != nil {
		return nil, err
	}
	// 新增名单：命中学生标记为重点人群
	if err := s.stuRepo.SetKeyGroupByIdentity(sg.StudentNo, sg.IDCard, true); err != nil {
		return nil, err
	}
	resp := dto.ToSpecialGroupResponse(sg)
	return &resp, nil
}

func (s *SpecialGroupService) Update(id uint, req *dto.SpecialGroupRequest) (*dto.SpecialGroupResponse, error) {
	sg, err := s.repo.Find(id)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	oldNo, oldCard := sg.StudentNo, sg.IDCard
	if err := applySpecialGroup(sg, req); err != nil {
		return nil, err
	}
	if err := s.repo.Save(sg); err != nil {
		return nil, err
	}
	// 身份可能变化：旧、新身份都重算
	if err := s.recompute(oldNo, oldCard); err != nil {
		return nil, err
	}
	if err := s.recompute(sg.StudentNo, sg.IDCard); err != nil {
		return nil, err
	}
	resp := dto.ToSpecialGroupResponse(sg)
	return &resp, nil
}

func (s *SpecialGroupService) Delete(id uint) error {
	sg, err := s.repo.Find(id)
	if repository.IsNotFound(err) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if err := s.repo.Delete(id); err != nil {
		return err
	}
	return s.recompute(sg.StudentNo, sg.IDCard)
}

// recompute 依据名单现状重算指定身份学生的 is_key_group。
func (s *SpecialGroupService) recompute(studentNo, idCard string) error {
	matched, err := s.repo.MatchExists(studentNo, idCard)
	if err != nil {
		return err
	}
	return s.stuRepo.SetKeyGroupByIdentity(studentNo, idCard, matched)
}

// applySpecialGroup 校验并写入重点人群模型。
func applySpecialGroup(sg *model.SpecialGroup, req *dto.SpecialGroupRequest) error {
	studentNo := strings.TrimSpace(req.StudentNo)
	idCard := strings.ToUpper(strings.TrimSpace(req.IDCard))
	if studentNo == "" && idCard == "" {
		return NewValidationError("学号与身份证号至少填写一个，用于与学生匹配")
	}
	if idCard != "" && !validate.IDCard(idCard) {
		return NewValidationError("身份证号格式不正确（需为 18 位有效号码）")
	}
	if !model.IsValidSpecialGroupType(req.Type) {
		return NewValidationError("特殊群体类型无效")
	}
	sg.StudentNo = studentNo
	sg.IDCard = idCard
	sg.Name = strings.TrimSpace(req.Name)
	sg.Type = model.SpecialGroupType(req.Type)
	sg.Source = strings.TrimSpace(req.Source)
	sg.Batch = strings.TrimSpace(req.Batch)
	sg.Year = req.Year
	return nil
}
