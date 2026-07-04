package service

import (
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"gorm.io/gorm"
)

// DictService 数据字典业务逻辑。
type DictService struct {
	repo *repository.DictRepository
}

func NewDictService(db *gorm.DB) *DictService {
	return &DictService{repo: repository.NewDictRepository(db)}
}

func (s *DictService) ListTypes() ([]string, error) {
	return s.repo.ListTypes()
}

func (s *DictService) ListByType(t string) ([]dto.DictResponse, error) {
	items, err := s.repo.ListByType(t)
	if err != nil {
		return nil, err
	}
	return dto.ToDictResponses(items), nil
}

func (s *DictService) CreateDict(t string, req *dto.DictCreateRequest) (*dto.DictResponse, error) {
	exists, err := s.repo.ExistsByTypeCode(t, req.Code)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrDuplicate
	}
	d := &model.Dict{Type: t, Code: req.Code, Label: req.Label, Sort: req.Sort}
	if err := s.repo.Create(d); err != nil {
		return nil, err
	}
	resp := dto.ToDictResponse(d)
	return &resp, nil
}

func (s *DictService) UpdateDict(t, code string, req *dto.DictUpdateRequest) (*dto.DictResponse, error) {
	d, err := s.repo.FindByTypeCode(t, code)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	d.Label = req.Label
	d.Sort = req.Sort
	if err := s.repo.Save(d); err != nil {
		return nil, err
	}
	resp := dto.ToDictResponse(d)
	return &resp, nil
}

func (s *DictService) DeleteDict(t, code string) error {
	if err := s.repo.DeleteByTypeCode(t, code); err != nil {
		if repository.IsNotFound(err) {
			return ErrNotFound
		}
		return err
	}
	return nil
}
