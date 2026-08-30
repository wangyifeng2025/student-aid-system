package service

import "errors"

// 跨模块通用业务错误（handler 层映射为 HTTP 状态码）。
var (
	ErrNotFound   = errors.New("记录不存在")
	ErrDuplicate  = errors.New("记录已存在")
	ErrInUse      = errors.New("存在关联数据，无法删除")
	ErrInvalidRef = errors.New("关联数据不存在")
)

type cannotDeleteError struct {
	reason string
}

func (e *cannotDeleteError) Error() string { return e.reason }
func (e *cannotDeleteError) Unwrap() error { return ErrInUse }

// CannotDelete 返回带原因的删除冲突（仍映射为 409）。
func CannotDelete(reason string) error {
	return &cannotDeleteError{reason: reason}
}

// ValidationError 字段校验错误，携带可直接展示给用户的中文信息（映射为 400）。
type ValidationError struct {
	Msg string
}

func (e *ValidationError) Error() string { return e.Msg }

// NewValidationError 构造字段校验错误。
func NewValidationError(msg string) *ValidationError {
	return &ValidationError{Msg: msg}
}
