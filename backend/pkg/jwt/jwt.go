package jwt

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

// TokenType 令牌类型。
type TokenType string

const (
	TokenTypeAccess  TokenType = "access"
	TokenTypeRefresh TokenType = "refresh"
)

// Claims 自定义 JWT 载荷。
type Claims struct {
	UserID    uint       `json:"uid"`
	Username  string     `json:"username"`
	Role      model.Role `json:"role"`
	TokenType TokenType  `json:"typ"`
	jwt.RegisteredClaims
}

// Manager JWT 管理器。
type Manager struct {
	secret             []byte
	issuer             string
	accessExpireHours  int
	refreshExpireHours int
}

func NewManager(secret, issuer string, accessExpireHours, refreshExpireHours int) *Manager {
	if accessExpireHours <= 0 {
		accessExpireHours = 24
	}
	if refreshExpireHours <= 0 {
		refreshExpireHours = 168 // 7 天
	}
	return &Manager{
		secret:             []byte(secret),
		issuer:             issuer,
		accessExpireHours:  accessExpireHours,
		refreshExpireHours: refreshExpireHours,
	}
}

// AccessExpireSeconds 访问令牌有效期（秒）。
func (m *Manager) AccessExpireSeconds() int {
	return m.accessExpireHours * 3600
}

// TokenPair 登录/刷新返回的双令牌。
type TokenPair struct {
	AccessToken  string
	RefreshToken string
	ExpiresIn    int // access token 秒数
}

// GeneratePair 签发 access + refresh 双令牌。
func (m *Manager) GeneratePair(u *model.User) (*TokenPair, error) {
	access, err := m.generate(u, TokenTypeAccess, m.accessExpireHours)
	if err != nil {
		return nil, err
	}
	refresh, err := m.generate(u, TokenTypeRefresh, m.refreshExpireHours)
	if err != nil {
		return nil, err
	}
	return &TokenPair{
		AccessToken:  access,
		RefreshToken: refresh,
		ExpiresIn:    m.AccessExpireSeconds(),
	}, nil
}

// Generate 签发访问令牌（兼容旧调用）。
func (m *Manager) Generate(u *model.User) (string, error) {
	return m.generate(u, TokenTypeAccess, m.accessExpireHours)
}

func (m *Manager) generate(u *model.User, typ TokenType, expireHours int) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:    u.ID,
		Username:  u.Username,
		Role:      u.Role,
		TokenType: typ,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(expireHours) * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

// Parse 解析访问令牌。
func (m *Manager) Parse(tokenString string) (*Claims, error) {
	return m.parse(tokenString, TokenTypeAccess)
}

// ParseRefresh 解析并校验刷新令牌。
func (m *Manager) ParseRefresh(tokenString string) (*Claims, error) {
	return m.parse(tokenString, TokenTypeRefresh)
}

func (m *Manager) parse(tokenString string, expectedType TokenType) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("无效的签名算法")
		}
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("无效的令牌")
	}
	if claims.TokenType != expectedType {
		return nil, fmt.Errorf("令牌类型不匹配: 期望 %s, 实际 %s", expectedType, claims.TokenType)
	}
	return claims, nil
}
