package service

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/database"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"gorm.io/gorm"
)

// backupTestDBName 备份/恢复测试会清空整库，因此必须跑在独立数据库上，
// 绝不能连到开发库。
const backupTestDBName = "student_aid_backup_test"

func TestBackupNamePattern(t *testing.T) {
	valid := []string{"backup-20260906-153000.zip", "prerestore-20260906-153000.zip", "a.zip"}
	for _, n := range valid {
		if !backupNamePattern.MatchString(n) {
			t.Errorf("%q 应被视为合法备份文件名", n)
		}
	}
	invalid := []string{
		"../etc/passwd.zip", "sub/dir.zip", "backup.tar.gz", ".hidden.zip", "", "backup-.zip.exe",
	}
	for _, n := range invalid {
		if backupNamePattern.MatchString(n) {
			t.Errorf("%q 不应被视为合法备份文件名", n)
		}
	}
}

func TestSafeJoinRejectsTraversal(t *testing.T) {
	base := t.TempDir()
	for _, rel := range []string{"../outside.txt", "a/../../outside.txt", `..\outside.txt`, ".."} {
		if _, err := safeJoin(base, rel); err == nil {
			t.Errorf("safeJoin(%q) 应被拒绝", rel)
		}
	}
	if _, err := safeJoin(base, "/abs/path.txt"); err != nil {
		t.Errorf("绝对路径应被裁剪为相对路径而非报错: %v", err)
	}
	got, err := safeJoin(base, "recognition/1/a.png")
	if err != nil {
		t.Fatalf("正常相对路径不应报错: %v", err)
	}
	if want := filepath.Join(base, "recognition", "1", "a.png"); got != want {
		t.Errorf("safeJoin = %q, want %q", got, want)
	}
}

func TestDecodeRestoreValue(t *testing.T) {
	num := func(s string) json.Number { return json.Number(s) }

	cases := []struct {
		name   string
		raw    any
		dbType string
		want   any
	}{
		{"整数列", num("42"), "INT8", int64(42)},
		{"整数列收到浮点文本", num("42.0"), "INT8", int64(42)},
		{"浮点列", num("1234.5"), "NUMERIC", 1234.5},
		{"布尔列", true, "BOOL", true},
		{"文本列", "张三", "VARCHAR", "张三"},
		{"文本列收到数字", num("2024"), "TEXT", "2024"},
		{"空值", nil, "TIMESTAMPTZ", nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := decodeRestoreValue(tc.raw, tc.dbType)
			if err != nil {
				t.Fatalf("decodeRestoreValue 报错: %v", err)
			}
			if got != tc.want {
				t.Errorf("got %#v, want %#v", got, tc.want)
			}
		})
	}

	t.Run("时间列", func(t *testing.T) {
		want := time.Date(2026, 9, 6, 15, 30, 0, 0, time.UTC)
		got, err := decodeRestoreValue(want.Format(time.RFC3339Nano), "TIMESTAMPTZ")
		if err != nil {
			t.Fatalf("解析时间失败: %v", err)
		}
		if ts, ok := got.(time.Time); !ok || !ts.Equal(want) {
			t.Errorf("got %#v, want %v", got, want)
		}
	})

	t.Run("二进制列", func(t *testing.T) {
		got, err := decodeRestoreValue(map[string]any{bytesKey: "aGVsbG8="}, "BYTEA")
		if err != nil {
			t.Fatalf("解析二进制失败: %v", err)
		}
		if string(got.([]byte)) != "hello" {
			t.Errorf("got %q, want %q", got, "hello")
		}
	})
}

func TestOrderByDeps(t *testing.T) {
	deps := func(pairs map[string][]string) map[string]map[string]struct{} {
		out := map[string]map[string]struct{}{}
		for child, parents := range pairs {
			out[child] = map[string]struct{}{}
			for _, p := range parents {
				out[child][p] = struct{}{}
			}
		}
		return out
	}
	indexOf := func(list []string, v string) int {
		for i, x := range list {
			if x == v {
				return i
			}
		}
		return -1
	}

	t.Run("被引用的表排在前面", func(t *testing.T) {
		tables := []string{"family_members", "recognition_applications", "students", "departments"}
		got := orderByDeps(tables, deps(map[string][]string{
			"family_members":           {"recognition_applications"},
			"recognition_applications": {"students"},
			"students":                 {"departments"},
		}))
		if len(got) != len(tables) {
			t.Fatalf("表数量变化: %v", got)
		}
		for _, pair := range [][2]string{
			{"departments", "students"},
			{"students", "recognition_applications"},
			{"recognition_applications", "family_members"},
		} {
			if indexOf(got, pair[0]) > indexOf(got, pair[1]) {
				t.Errorf("%s 应排在 %s 之前，实际顺序 %v", pair[0], pair[1], got)
			}
		}
	})

	t.Run("自引用与外部依赖不影响排序", func(t *testing.T) {
		tables := []string{"a", "b"}
		got := orderByDeps(tables, deps(map[string][]string{
			"a": {"a", "not_in_backup"},
			"b": {"a"},
		}))
		if len(got) != 2 || got[0] != "a" || got[1] != "b" {
			t.Errorf("got %v, want [a b]", got)
		}
	})

	t.Run("存在环时不丢表", func(t *testing.T) {
		tables := []string{"a", "b", "c"}
		got := orderByDeps(tables, deps(map[string][]string{
			"a": {"b"},
			"b": {"a"},
		}))
		if len(got) != 3 {
			t.Fatalf("环状依赖不应丢表: %v", got)
		}
	})
}

// TestBackupRestoreRoundTrip 在独立测试库上跑完整的「备份 → 破坏数据 → 恢复」链路。
func TestBackupRestoreRoundTrip(t *testing.T) {
	db, cfg := setupBackupTestDB(t)

	dept := model.Department{Name: "计算机系", Code: "CS"}
	mustCreate(t, db, &dept)
	student := model.Student{
		StudentNo: "2024010101",
		Name:      "张三",
		IDCard:    "520101200601011234",
		DeptID:    dept.ID,
	}
	mustCreate(t, db, &student)
	app := model.RecognitionApplication{
		StudentID:             student.ID,
		Year:                  2026,
		Nation:                "汉族",
		PerCapitaAnnualIncome: 3200.5,
		CommitmentAgreed:      true,
		Status:                model.StatusDraft,
	}
	mustCreate(t, db, &app)
	// 子表用于验证恢复时的外键写入顺序。
	mustCreate(t, db, &model.FamilyMember{
		ApplicationID: app.ID,
		Name:          "张父",
		Age:           48,
		AnnualIncome:  8000,
	})

	uploadRel := filepath.Join("recognition", "1", "proof.png")
	writeFile(t, filepath.Join(cfg.Upload.Dir, uploadRel), "original-attachment")

	svc := NewBackupService(db, cfg)

	item, err := svc.Create("tester", dto.CreateBackupRequest{Note: "回归测试"})
	if err != nil {
		t.Fatalf("创建备份失败: %v", err)
	}
	if item.Manifest.TotalRows < 4 {
		t.Fatalf("备份行数异常: %d", item.Manifest.TotalRows)
	}
	if item.Manifest.UploadFiles != 1 {
		t.Fatalf("附件数量 = %d, want 1", item.Manifest.UploadFiles)
	}

	// 模拟误删与脏数据，外加一个备份之后才出现的附件。
	if err := db.Exec("DELETE FROM family_members").Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Unscoped().Delete(&model.Student{}, student.ID).Error; err != nil {
		t.Fatal(err)
	}
	mustCreate(t, db, &model.Dict{Type: "junk", Code: "junk", Label: "备份之后写入的脏数据"})
	writeFile(t, filepath.Join(cfg.Upload.Dir, "recognition", "9", "stray.png"), "stray")
	if err := os.Remove(filepath.Join(cfg.Upload.Dir, uploadRel)); err != nil {
		t.Fatal(err)
	}

	res, err := svc.RestoreFromStored("tester", item.Name)
	if err != nil {
		t.Fatalf("恢复失败: %v", err)
	}
	if res.SafetyBackup == "" {
		t.Error("恢复应先自动生成回滚备份")
	}
	if res.RestoredFiles != 1 {
		t.Errorf("恢复附件数 = %d, want 1", res.RestoredFiles)
	}

	assertCount(t, db, &model.Student{}, 1, "学生")
	assertCount(t, db, &model.FamilyMember{}, 1, "家庭成员")
	assertCount(t, db, &model.Department{}, 1, "院系")

	var junk int64
	if err := db.Model(&model.Dict{}).Where("type = ?", "junk").Count(&junk).Error; err != nil {
		t.Fatal(err)
	}
	if junk != 0 {
		t.Errorf("备份之后写入的脏数据应被清除，仍有 %d 条", junk)
	}

	var got model.Student
	if err := db.First(&got, student.ID).Error; err != nil {
		t.Fatalf("恢复后未找到原学生: %v", err)
	}
	if got.Name != "张三" || got.StudentNo != "2024010101" || got.DeptID != dept.ID {
		t.Errorf("学生字段未正确还原: %+v", got)
	}

	var gotApp model.RecognitionApplication
	if err := db.First(&gotApp, app.ID).Error; err != nil {
		t.Fatalf("恢复后未找到认定申请: %v", err)
	}
	if gotApp.PerCapitaAnnualIncome != 3200.5 || !gotApp.CommitmentAgreed || gotApp.Year != 2026 {
		t.Errorf("认定申请字段未正确还原: %+v", gotApp)
	}
	if gotApp.CreatedAt.Unix() != app.CreatedAt.Unix() {
		t.Errorf("创建时间未正确还原: got %v, want %v", gotApp.CreatedAt, app.CreatedAt)
	}

	// 附件目录应回到备份时的状态：原文件回来，之后新增的文件消失。
	content, err := os.ReadFile(filepath.Join(cfg.Upload.Dir, uploadRel))
	if err != nil {
		t.Fatalf("附件未恢复: %v", err)
	}
	if string(content) != "original-attachment" {
		t.Errorf("附件内容 = %q", content)
	}
	if _, err := os.Stat(filepath.Join(cfg.Upload.Dir, "recognition", "9", "stray.png")); !os.IsNotExist(err) {
		t.Error("备份之后新增的附件应在恢复后消失")
	}

	// 序列必须被推到最大 id 之后，否则新增记录会主键冲突。
	fresh := model.Student{StudentNo: "2024010102", Name: "李四", IDCard: "520101200601011235"}
	if err := db.Create(&fresh).Error; err != nil {
		t.Fatalf("恢复后新增学生失败（自增序列未重置）: %v", err)
	}
	if fresh.ID <= student.ID {
		t.Errorf("新学生 id = %d, 应大于 %d", fresh.ID, student.ID)
	}
}

func TestRestoreRejectsNonArchive(t *testing.T) {
	db, cfg := setupBackupTestDB(t)
	svc := NewBackupService(db, cfg)

	bad := filepath.Join(cfg.Backup.Dir, "broken.zip")
	writeFile(t, bad, "this is not a zip")

	if _, err := svc.RestoreFromStored("tester", "broken.zip"); err == nil {
		t.Error("损坏的归档应被拒绝")
	}
	if _, err := svc.RestoreFromStored("tester", "../../etc/passwd.zip"); err == nil {
		t.Error("越权路径应被拒绝")
	}
}

// setupBackupTestDB 创建并连接一次性测试库，测试结束后删除。
// 数据库不可用时跳过，与其它集成测试保持一致。
func setupBackupTestDB(t *testing.T) (*gorm.DB, *config.Config) {
	t.Helper()

	base, err := config.Load()
	if err != nil {
		t.Fatalf("加载配置失败: %v", err)
	}
	if base.Database.Driver != "" && base.Database.Driver != "postgres" {
		t.Skipf("备份恢复测试目前仅覆盖 postgres，当前 driver=%s", base.Database.Driver)
	}
	if base.Database.Name == backupTestDBName {
		t.Fatal("配置指向的库与测试库同名，可能误删数据")
	}

	admin, err := database.New(base)
	if err != nil {
		t.Skipf("无法连接数据库，跳过测试: %v", err)
	}
	adminSQL, err := admin.DB()
	if err != nil {
		t.Fatal(err)
	}
	if err := adminSQL.Ping(); err != nil {
		adminSQL.Close()
		t.Skipf("数据库 Ping 失败，跳过测试: %v", err)
	}

	admin.Exec("DROP DATABASE IF EXISTS " + backupTestDBName)
	if err := admin.Exec("CREATE DATABASE " + backupTestDBName).Error; err != nil {
		adminSQL.Close()
		t.Skipf("无法创建测试数据库，跳过测试: %v", err)
	}

	cfg := *base
	cfg.Database.Name = backupTestDBName
	root := t.TempDir()
	cfg.Upload.Dir = filepath.Join(root, "uploads")
	cfg.Backup.Dir = filepath.Join(root, "backups")
	cfg.Backup.MaxKeep = 0
	if err := os.MkdirAll(cfg.Upload.Dir, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(cfg.Backup.Dir, 0o750); err != nil {
		t.Fatal(err)
	}

	db, err := database.New(&cfg)
	if err != nil {
		adminSQL.Close()
		t.Fatalf("连接测试库失败: %v", err)
	}
	if err := db.AutoMigrate(model.AllModels()...); err != nil {
		t.Fatalf("迁移测试库失败: %v", err)
	}

	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
		admin.Exec("DROP DATABASE IF EXISTS " + backupTestDBName)
		adminSQL.Close()
	})

	return db, &cfg
}

func mustCreate(t *testing.T, db *gorm.DB, v any) {
	t.Helper()
	if err := db.Create(v).Error; err != nil {
		t.Fatalf("写入测试数据失败: %v", err)
	}
}

func assertCount(t *testing.T, db *gorm.DB, m any, want int64, label string) {
	t.Helper()
	var got int64
	if err := db.Model(m).Count(&got).Error; err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Errorf("%s 数量 = %d, want %d", label, got, want)
	}
}

func writeFile(t *testing.T, p, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(p), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte(content), 0o640); err != nil {
		t.Fatal(err)
	}
}
