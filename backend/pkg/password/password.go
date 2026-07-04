package password

import (
	"errors"
	"unicode"

	"golang.org/x/crypto/bcrypt"
)

const minLength = 6

// Hash 使用 bcrypt 哈希密码。
func Hash(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// Verify 校验明文密码与哈希是否匹配。
func Verify(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// Validate 校验密码强度（至少 6 位，含字母和数字）。
func Validate(password string) error {
	if len(password) < minLength {
		return errors.New("密码长度不能少于 6 位")
	}
	var hasLetter, hasDigit bool
	for _, r := range password {
		switch {
		case unicode.IsLetter(r):
			hasLetter = true
		case unicode.IsDigit(r):
			hasDigit = true
		}
	}
	if !hasLetter || !hasDigit {
		return errors.New("密码需同时包含字母和数字")
	}
	return nil
}
