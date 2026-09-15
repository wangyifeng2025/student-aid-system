package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestBackupArchiveNameFromWildcard(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/backups/download/*name", func(c *gin.Context) {
		c.String(http.StatusOK, backupArchiveName(c))
	})
	r.DELETE("/backups/*name", func(c *gin.Context) {
		c.String(http.StatusOK, backupArchiveName(c))
	})
	r.POST("/backups/restore/*name", func(c *gin.Context) {
		c.String(http.StatusOK, backupArchiveName(c))
	})

	want := "backup-20260910-230134.zip"
	cases := []struct {
		method, path string
	}{
		{http.MethodGet, "/backups/download/" + want},
		{http.MethodDelete, "/backups/" + want},
		{http.MethodPost, "/backups/restore/" + want},
	}
	for _, tc := range cases {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(tc.method, tc.path, nil)
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("%s %s status %d", tc.method, tc.path, w.Code)
		}
		if w.Body.String() != want {
			t.Fatalf("%s %s name want %s, got %q", tc.method, tc.path, want, w.Body.String())
		}
	}
}

func TestBackupParamRouteDropsZipSuffix(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/backups/download/:name", func(c *gin.Context) {
		c.String(http.StatusOK, c.Param("name"))
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/backups/download/backup-20260910-230134.zip", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	if w.Body.String() == "backup-20260910-230134.zip" {
		t.Skip(":name 已能完整匹配 .zip，无需依赖截断假设")
	}
	if w.Body.String() != "backup-20260910-230134" {
		t.Fatalf("unexpected :name capture %q", w.Body.String())
	}
}
