package dto

import (
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

// ===== 模块 5：四级评审与退回 =====

// ReviewActionRequest 单条评审动作请求（通过/退回共用）。
type ReviewActionRequest struct {
	// 通过时（尤其班级级）初定/调整困难等级；退回时忽略。
	DifficultyLevel string `json:"difficulty_level"`
	// 评审意见；退回时建议必填，前端会校验。
	Opinion string `json:"opinion"`
	// 退回时目标级别：0=学生重填，1=班级，2=教学系，3=院级；nil 视为 0。
	RejectToLevel *int `json:"reject_to_level"`
}

// BatchReviewRequest 批量评审请求（边看边打勾，快速定档）。
type BatchReviewRequest struct {
	IDs             []uint `json:"ids" binding:"required"`
	Action          string `json:"action" binding:"required"` // pass / reject
	DifficultyLevel string `json:"difficulty_level"`
	Opinion         string `json:"opinion"`
	RejectToLevel   *int   `json:"reject_to_level"`
}

// BatchReviewItemResult 批量评审单条结果。
type BatchReviewItemResult struct {
	ID      uint   `json:"id"`
	OK      bool   `json:"ok"`
	Message string `json:"message,omitempty"`
}

// BatchReviewResult 批量评审汇总结果。
type BatchReviewResult struct {
	Total   int                     `json:"total"`
	Success int                     `json:"success"`
	Failed  int                     `json:"failed"`
	Items   []BatchReviewItemResult `json:"items"`
}

// ReviewRecordResponse 评审流转记录（审计 / 进度日志）。
type ReviewRecordResponse struct {
	ID              uint      `json:"id"`
	Level           int       `json:"level"`
	ReviewerID      uint      `json:"reviewer_id"`
	ReviewerName    string    `json:"reviewer_name"`
	Action          string    `json:"action"`
	Opinion         string    `json:"opinion"`
	DifficultyLevel string    `json:"difficulty_level"`
	RejectToLevel   int       `json:"reject_to_level"`
	CreatedAt       time.Time `json:"created_at"`
}

// ToReviewRecordResponses 组装评审记录列表；names 为 reviewer_id->姓名 映射。
func ToReviewRecordResponses(items []model.ReviewRecord, names map[uint]string) []ReviewRecordResponse {
	out := make([]ReviewRecordResponse, 0, len(items))
	for i := range items {
		r := &items[i]
		out = append(out, ReviewRecordResponse{
			ID:              r.ID,
			Level:           int(r.Level),
			ReviewerID:      r.ReviewerID,
			ReviewerName:    names[r.ReviewerID],
			Action:          string(r.Action),
			Opinion:         r.Opinion,
			DifficultyLevel: string(r.DifficultyLevel),
			RejectToLevel:   int(r.RejectToLevel),
			CreatedAt:       r.CreatedAt,
		})
	}
	return out
}
