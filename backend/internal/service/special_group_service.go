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
	orgRepo *repository.OrgRepository
}

func NewSpecialGroupService(db *gorm.DB) *SpecialGroupService {
	return &SpecialGroupService{
		repo:    repository.NewSpecialGroupRepository(db),
		stuRepo: repository.NewStudentRepository(db),
		orgRepo: repository.NewOrgRepository(db),
	}
}

func (s *SpecialGroupService) List(f repository.SpecialGroupFilter) (*dto.PageResult[dto.SpecialGroupResponse], error) {
	items, total, err := s.repo.List(f)
	if err != nil {
		return nil, err
	}
	out := dto.ToSpecialGroupResponses(items)
	if err := s.attachOrg(items, out); err != nil {
		return nil, err
	}
	return &dto.PageResult[dto.SpecialGroupResponse]{
		Items:    out,
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

// attachOrg 用学号或身份证匹配学籍，回填专业名与班级名。对不上的记录留空。
func (s *SpecialGroupService) attachOrg(items []model.SpecialGroup, out []dto.SpecialGroupResponse) error {
	if len(items) == 0 {
		return nil
	}
	nos := make([]string, 0, len(items))
	cards := make([]string, 0, len(items))
	seenNo := map[string]struct{}{}
	seenCard := map[string]struct{}{}
	for i := range items {
		if no := strings.TrimSpace(items[i].StudentNo); no != "" {
			if _, ok := seenNo[no]; !ok {
				seenNo[no] = struct{}{}
				nos = append(nos, no)
			}
		}
		if card := strings.TrimSpace(items[i].IDCard); card != "" {
			if _, ok := seenCard[card]; !ok {
				seenCard[card] = struct{}{}
				cards = append(cards, card)
			}
		}
	}
	students, err := s.stuRepo.FindByIdentities(nos, cards)
	if err != nil {
		return err
	}
	byNo := make(map[string]model.Student, len(students))
	byCard := make(map[string]model.Student, len(students))
	for i := range students {
		stu := students[i]
		if stu.StudentNo != "" {
			if _, ok := byNo[stu.StudentNo]; !ok {
				byNo[stu.StudentNo] = stu
			}
		}
		if stu.IDCard != "" {
			if _, ok := byCard[stu.IDCard]; !ok {
				byCard[stu.IDCard] = stu
			}
		}
	}
	_, majorNames, classNames, err := buildOrgNameMaps(s.orgRepo)
	if err != nil {
		return err
	}
	for i := range items {
		stu, ok := matchSpecialGroupStudent(items[i], byNo, byCard)
		if !ok {
			continue
		}
		out[i].MajorName = majorNames[stu.MajorID]
		out[i].ClassName = classNames[stu.ClassID]
	}
	return nil
}

func matchSpecialGroupStudent(sg model.SpecialGroup, byNo, byCard map[string]model.Student) (model.Student, bool) {
	if no := strings.TrimSpace(sg.StudentNo); no != "" {
		if stu, ok := byNo[no]; ok {
			return stu, true
		}
	}
	if card := strings.TrimSpace(sg.IDCard); card != "" {
		if stu, ok := byCard[card]; ok {
			return stu, true
		}
	}
	return model.Student{}, false
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
