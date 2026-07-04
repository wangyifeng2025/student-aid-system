package service

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/rbac"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"gorm.io/gorm"
)

// OwnerTypeRecognition 附件归属类型：认定申请。
const OwnerTypeRecognition = "recognition"

// AttachmentService 支撑材料附件的上传/列出/下载/删除。
type AttachmentService struct {
	cfg     *config.Config
	repo    *repository.AttachmentRepository
	recRepo *repository.RecognitionRepository
	stuRepo *repository.StudentRepository
}

func NewAttachmentService(db *gorm.DB, cfg *config.Config) *AttachmentService {
	return &AttachmentService{
		cfg:     cfg,
		repo:    repository.NewAttachmentRepository(db),
		recRepo: repository.NewRecognitionRepository(db),
		stuRepo: repository.NewStudentRepository(db),
	}
}

// UploadToRecognition 上传支撑材料到指定认定申请（仅申请所属学生本人）。
func (s *AttachmentService) UploadToRecognition(actor rbac.Actor, appID uint, fh *multipart.FileHeader) (*dto.AttachmentResponse, error) {
	if err := s.requireRecognitionOwner(actor, appID); err != nil {
		return nil, err
	}
	if err := s.validateFile(fh); err != nil {
		return nil, err
	}

	ext := strings.ToLower(filepath.Ext(fh.Filename))
	relDir := filepath.Join(OwnerTypeRecognition, fmt.Sprintf("%d", appID))
	absDir := filepath.Join(s.cfg.Upload.Dir, relDir)
	if err := os.MkdirAll(absDir, 0o755); err != nil {
		return nil, err
	}
	storedName := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	relPath := filepath.Join(relDir, storedName)
	absPath := filepath.Join(absDir, storedName)

	if err := saveUpload(fh, absPath); err != nil {
		return nil, err
	}

	att := &model.Attachment{
		OwnerType:  OwnerTypeRecognition,
		OwnerID:    appID,
		FileName:   fh.Filename,
		Path:       relPath,
		Size:       fh.Size,
		Mime:       fh.Header.Get("Content-Type"),
		UploaderID: actor.UserID,
	}
	if err := s.repo.Create(att); err != nil {
		_ = os.Remove(absPath)
		return nil, err
	}
	resp := dto.ToAttachmentResponse(att)
	return &resp, nil
}

// ListForRecognition 列出某认定申请的附件（按数据范围校验读取权）。
func (s *AttachmentService) ListForRecognition(actor rbac.Actor, appID uint) ([]dto.AttachmentResponse, error) {
	ok, err := s.recRepo.CanAccess(actor, appID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound
	}
	items, err := s.repo.ListByOwner(OwnerTypeRecognition, appID)
	if err != nil {
		return nil, err
	}
	return dto.ToAttachmentResponses(items), nil
}

// OpenForDownload 校验访问权后返回附件元数据与绝对路径，供 handler 流式下载。
func (s *AttachmentService) OpenForDownload(actor rbac.Actor, attID uint) (*model.Attachment, string, error) {
	att, err := s.repo.FindByID(attID)
	if repository.IsNotFound(err) {
		return nil, "", ErrNotFound
	}
	if err != nil {
		return nil, "", err
	}
	if att.OwnerType != OwnerTypeRecognition {
		return nil, "", ErrNotFound
	}
	ok, err := s.recRepo.CanAccess(actor, att.OwnerID)
	if err != nil {
		return nil, "", err
	}
	if !ok {
		return nil, "", ErrForbidden
	}
	return att, filepath.Join(s.cfg.Upload.Dir, att.Path), nil
}

// Delete 删除附件（仅申请所属学生本人）。
func (s *AttachmentService) Delete(actor rbac.Actor, attID uint) error {
	att, err := s.repo.FindByID(attID)
	if repository.IsNotFound(err) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if att.OwnerType != OwnerTypeRecognition {
		return ErrNotFound
	}
	if err := s.requireRecognitionOwner(actor, att.OwnerID); err != nil {
		return err
	}
	if err := s.repo.Delete(attID); err != nil {
		return err
	}
	_ = os.Remove(filepath.Join(s.cfg.Upload.Dir, att.Path))
	return nil
}

// requireRecognitionOwner 校验操作者为该认定申请所属的学生本人。
func (s *AttachmentService) requireRecognitionOwner(actor rbac.Actor, appID uint) error {
	if actor.Role != model.RoleStudent {
		return ErrForbidden
	}
	a, err := s.recRepo.FindByID(appID)
	if repository.IsNotFound(err) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	stu, err := s.stuRepo.FindStudent(a.StudentID)
	if err != nil {
		return err
	}
	if stu.UserID == nil || *stu.UserID != actor.UserID {
		return ErrForbidden
	}
	return nil
}

// validateFile 校验上传文件的大小与扩展名（依据 upload 配置）。
func (s *AttachmentService) validateFile(fh *multipart.FileHeader) error {
	maxBytes := int64(s.cfg.Upload.MaxSizeMB) * 1024 * 1024
	if maxBytes > 0 && fh.Size > maxBytes {
		return NewValidationError(fmt.Sprintf("文件超过大小限制（最大 %d MB）", s.cfg.Upload.MaxSizeMB))
	}
	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if ext == "" {
		return NewValidationError("文件缺少扩展名")
	}
	allowed := s.allowedExts()
	if len(allowed) > 0 {
		if _, ok := allowed[ext]; !ok {
			return NewValidationError("不支持的文件类型：" + ext)
		}
	}
	return nil
}

func (s *AttachmentService) allowedExts() map[string]struct{} {
	out := map[string]struct{}{}
	for _, e := range strings.Split(s.cfg.Upload.AllowedExts, ",") {
		e = strings.ToLower(strings.TrimSpace(e))
		if e != "" {
			out[e] = struct{}{}
		}
	}
	return out
}

// saveUpload 将上传文件落盘到目标路径。
func saveUpload(fh *multipart.FileHeader, absPath string) error {
	src, err := fh.Open()
	if err != nil {
		return err
	}
	defer src.Close()
	dst, err := os.Create(absPath)
	if err != nil {
		return err
	}
	defer dst.Close()
	_, err = io.Copy(dst, src)
	return err
}
