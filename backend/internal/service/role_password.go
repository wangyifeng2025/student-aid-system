package service

import (
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

// roleInitialPassword 按角色生成初始/重置密码。
// 班主任 Adv、系管理员 Dept、学院管理员（资助中心）Aid，均拼手机号后 6 位数字。
func roleInitialPassword(role model.Role, phone string) (string, error) {
	switch role {
	case model.RoleClassAdvisor:
		return prefixedPhonePassword("Adv", phone, "Adv123456")
	case model.RoleDepartment:
		return prefixedPhonePassword("Dept", phone, "")
	case model.RoleAidCenter:
		return prefixedPhonePassword("Aid", phone, "")
	default:
		return "", NewValidationError("该角色不能按手机号规则生成密码，请填写新密码")
	}
}

func usesPhonePasswordRule(role model.Role) bool {
	return role == model.RoleClassAdvisor || role == model.RoleDepartment || role == model.RoleAidCenter
}

// prefixedPhonePassword 用前缀 + 手机号中的数字后 6 位拼密码。
// fallback 非空时，位数不足则用 fallback（班主任沿用 Adv123456）；
// fallback 为空时位数不足返回错误，避免系/院账号拿到猜得出的弱口令。
func prefixedPhonePassword(prefix, phone, fallback string) (string, error) {
	digits := digitsOnly(phone)
	if len(digits) >= 6 {
		return prefix + digits[len(digits)-6:], nil
	}
	if fallback != "" {
		return fallback, nil
	}
	return "", NewValidationError("请先填写至少 6 位数字的手机号，才能按 " + prefix + "＋手机后 6 位生成密码")
}

func digitsOnly(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
