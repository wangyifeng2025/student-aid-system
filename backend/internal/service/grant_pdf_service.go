package service

import (
	"fmt"
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"gorm.io/gorm"
)

// GrantPDFService 国家助学金申请表 Word 导出（审批通过后可导出）。
// 基于 Word 模板填数，直接返回 docx，无需外部依赖。
type GrantPDFService struct {
	cfg      *config.Config
	repo     *repository.GrantRepository
	stuRepo  *repository.StudentRepository
	orgRepo  *repository.OrgRepository
	dictRepo *repository.DictRepository
}

func NewGrantPDFService(db *gorm.DB, cfg *config.Config) *GrantPDFService {
	return &GrantPDFService{
		cfg:      cfg,
		repo:     repository.NewGrantRepository(db),
		stuRepo:  repository.NewStudentRepository(db),
		orgRepo:  repository.NewOrgRepository(db),
		dictRepo: repository.NewDictRepository(db),
	}
}

func (s *GrantPDFService) Export(actor rbac.Actor, id uint) ([]byte, string, error) {
	ok, err := s.repo.CanAccess(actor, id)
	if err != nil {
		return nil, "", err
	}
	if !ok {
		return nil, "", ErrNotFound
	}
	a, err := s.repo.FindByID(id)
	if repository.IsNotFound(err) {
		return nil, "", ErrNotFound
	}
	if err != nil {
		return nil, "", err
	}
	if a.Status != model.GrantStatusApproved {
		return nil, "", NewValidationError("仅审批通过的助学金申请可导出申请表")
	}

	stu, _ := s.stuRepo.FindStudent(a.StudentID)
	schoolUnit, gradeName := resolveGrantSchoolUnit(s.orgRepo, stu)
	labels := s.loadLabelMaps()
	replacements := buildGrantDocxReplacements(s.cfg, a, stu, schoolUnit, gradeName, labels)

	docxBytes, err := exportGrantDocx(s.cfg, replacements)
	if err != nil {
		return nil, "", err
	}

	studentNo := studentNo(stu)
	filename := fmt.Sprintf("grant_national_aid_%d_%s.docx", a.Year, studentNo)
	return docxBytes, filename, nil
}

func (s *GrantPDFService) loadLabelMaps() labelMaps {
	types := []string{"nation", "political_status", "income_source", "relation"}
	maps := make(map[string]map[string]string, len(types))
	for _, t := range types {
		m := map[string]string{}
		if items, err := s.dictRepo.ListByType(t); err == nil {
			for i := range items {
				m[items[i].Code] = items[i].Label
			}
		}
		maps[t] = m
	}
	return labelMaps{maps: maps}
}

func grantReviewOpinion(reviews []model.GrantReviewRecord, level model.ReviewLevel) string {
	for i := len(reviews) - 1; i >= 0; i-- {
		r := reviews[i]
		if r.Level == level && r.Action == model.ActionPass {
			if strings.TrimSpace(r.Opinion) != "" {
				return r.Opinion
			}
			return "同意"
		}
	}
	return ""
}
