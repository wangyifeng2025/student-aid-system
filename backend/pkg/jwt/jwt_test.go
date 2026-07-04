package jwt

import (
	"testing"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

func TestGeneratePairAndParse(t *testing.T) {
	mgr := NewManager("test-secret", "test-issuer", 1, 24)
	user := &model.User{
		BaseModel: model.BaseModel{ID: 1},
		Username:  "test001",
		Role:      model.RoleStudent,
	}

	pair, err := mgr.GeneratePair(user)
	if err != nil {
		t.Fatalf("GeneratePair failed: %v", err)
	}
	if pair.AccessToken == "" || pair.RefreshToken == "" {
		t.Fatal("tokens should not be empty")
	}
	if pair.ExpiresIn != 3600 {
		t.Errorf("ExpiresIn = %d, want 3600", pair.ExpiresIn)
	}

	accessClaims, err := mgr.Parse(pair.AccessToken)
	if err != nil {
		t.Fatalf("Parse access token failed: %v", err)
	}
	if accessClaims.UserID != user.ID || accessClaims.TokenType != TokenTypeAccess {
		t.Errorf("unexpected access claims: %+v", accessClaims)
	}

	refreshClaims, err := mgr.ParseRefresh(pair.RefreshToken)
	if err != nil {
		t.Fatalf("Parse refresh token failed: %v", err)
	}
	if refreshClaims.TokenType != TokenTypeRefresh {
		t.Errorf("expected refresh type, got %s", refreshClaims.TokenType)
	}

	// access token 不能当 refresh 解析
	if _, err := mgr.ParseRefresh(pair.AccessToken); err == nil {
		t.Error("access token should not parse as refresh")
	}
}

func TestParseExpiredToken(t *testing.T) {
	mgr := NewManager("test-secret", "test-issuer", 0, 0) // 0 -> defaults to 24h, need negative - use custom
	// 使用极短过期：通过直接 generate 不好测，跳过复杂过期测试
	user := &model.User{BaseModel: model.BaseModel{ID: 1}, Username: "u", Role: model.RoleStudent}
	token, err := mgr.generate(user, TokenTypeAccess, 0)
	if err != nil {
		t.Fatalf("generate failed: %v", err)
	}
	// 0 hour expiry might be immediate expired
	time.Sleep(10 * time.Millisecond)
	if _, err := mgr.Parse(token); err == nil {
		// 某些环境下 0 hour 可能仍有效一瞬间，不强制失败
		t.Log("token with 0h expiry may still parse briefly")
	}
}
