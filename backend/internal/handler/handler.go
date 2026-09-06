package handler

import (
	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/service"
	"github.com/wangyifeng2025/student-aid-system/pkg/jwt"
	"gorm.io/gorm"
)

// Handler 持有处理器所需的公共依赖。
type Handler struct {
	DB                 *gorm.DB
	Cfg                *config.Config
	JWT                *jwt.Manager
	Auth               *service.AuthService
	Org                *service.OrgService
	Dict               *service.DictService
	Student            *service.StudentService
	SpecialGroup       *service.SpecialGroupService
	Import             *service.ImportService
	Recognition        *service.RecognitionService
	RecognitionPDF     *service.RecognitionPDFService
	RecognitionSummary *service.RecognitionSummaryExportService
	Attachment         *service.AttachmentService
	Review             *service.ReviewService
	Grant              *service.GrantService
	GrantReview        *service.GrantReviewService
	GrantPDF           *service.GrantPDFService
	User               *service.UserService
	Advisor            *service.AdvisorService
	RegionCode         *service.RegionCodeService
	Dashboard          *service.DashboardService
	Backup             *service.BackupService
}

func New(db *gorm.DB, cfg *config.Config, jwtMgr *jwt.Manager) *Handler {
	return &Handler{
		DB:                 db,
		Cfg:                cfg,
		JWT:                jwtMgr,
		Auth:               service.NewAuthService(db, jwtMgr),
		Org:                service.NewOrgService(db),
		Dict:               service.NewDictService(db),
		Student:            service.NewStudentService(db),
		SpecialGroup:       service.NewSpecialGroupService(db),
		Import:             service.NewImportService(db),
		Recognition:        service.NewRecognitionService(db),
		RecognitionPDF:     service.NewRecognitionPDFService(db, cfg),
		RecognitionSummary: service.NewRecognitionSummaryExportService(db, cfg),
		Attachment:         service.NewAttachmentService(db, cfg),
		Review:             service.NewReviewService(db),
		Grant:              service.NewGrantService(db),
		GrantReview:        service.NewGrantReviewService(db),
		GrantPDF:           service.NewGrantPDFService(db, cfg),
		User:               service.NewUserService(db),
		Advisor:            service.NewAdvisorService(db),
		RegionCode:         service.NewRegionCodeService(db),
		Dashboard:          service.NewDashboardService(db),
		Backup:             service.NewBackupService(db, cfg),
	}
}
