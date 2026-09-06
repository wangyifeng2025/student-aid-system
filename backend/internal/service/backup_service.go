package service

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"gorm.io/gorm"
)

const (
	backupManifestName = "manifest.json"
	backupDataPrefix   = "data/"
	backupUploadPrefix = "uploads/"

	backupFilePrefix     = "backup-"
	preRestoreFilePrefix = "prerestore-"
	backupFileExt        = ".zip"
	backupTimeLayout     = "20060102-150405"
)

// backupNamePattern 限制归档文件名，杜绝路径穿越与访问备份目录之外的文件。
var backupNamePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.zip$`)

// BackupService 全量数据备份与恢复。
//
// 归档是一个 zip，结构如下：
//
//	manifest.json          备份元信息（表清单、行数、附件数量等）
//	data/<table>.jsonl     每张表一份，首行列定义、其后每行一条记录
//	uploads/<相对路径>      上传目录内的附件原文件
//
// 采用应用层导出而非 pg_dump，是为了让备份不依赖服务器上是否安装
// PostgreSQL 客户端工具，本地开发与容器部署行为一致。
type BackupService struct {
	db  *gorm.DB
	cfg *config.Config
	// mu 串行化备份与恢复，避免并发写归档或并发改库。
	mu sync.Mutex
}

func NewBackupService(db *gorm.DB, cfg *config.Config) *BackupService {
	return &BackupService{db: db, cfg: cfg}
}

func (s *BackupService) driver() string {
	if s.cfg.Database.Driver == "mysql" {
		return "mysql"
	}
	return "postgres"
}

func (s *BackupService) dir() string {
	d := strings.TrimSpace(s.cfg.Backup.Dir)
	if d == "" {
		d = "./backups"
	}
	return d
}

// ===== 创建 =====

// Create 生成一份全量备份并落盘到备份目录。
func (s *BackupService) Create(operator string, req dto.CreateBackupRequest) (*dto.BackupItem, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.create(operator, req, backupFilePrefix)
}

func (s *BackupService) create(operator string, req dto.CreateBackupRequest, prefix string) (*dto.BackupItem, error) {
	dir := s.dir()
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, fmt.Errorf("创建备份目录失败: %w", err)
	}

	withUploads := req.WithUploads == nil || *req.WithUploads
	name := prefix + time.Now().Format(backupTimeLayout) + backupFileExt
	target := filepath.Join(dir, name)

	// 先写临时文件，成功后再改名，避免中断留下半截归档被当成可用备份。
	tmp, err := os.CreateTemp(dir, ".writing-*"+backupFileExt)
	if err != nil {
		return nil, fmt.Errorf("创建备份文件失败: %w", err)
	}
	tmpPath := tmp.Name()
	cleanup := func() {
		tmp.Close()
		os.Remove(tmpPath)
	}

	manifest, err := s.writeArchive(tmp, operator, strings.TrimSpace(req.Note), withUploads)
	if err != nil {
		cleanup()
		return nil, err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpPath)
		return nil, err
	}
	if err := os.Rename(tmpPath, target); err != nil {
		os.Remove(tmpPath)
		return nil, fmt.Errorf("保存备份文件失败: %w", err)
	}

	s.prune()

	info, err := os.Stat(target)
	if err != nil {
		return nil, err
	}
	return &dto.BackupItem{
		Name:      name,
		Size:      info.Size(),
		CreatedAt: manifest.CreatedAt,
		Manifest:  manifest,
	}, nil
}

// writeArchive 把数据库与附件写入 zip，返回 manifest。
func (s *BackupService) writeArchive(w io.Writer, operator, note string, withUploads bool) (*dto.BackupManifest, error) {
	zw := zip.NewWriter(w)

	tables, err := tableNamesFromModels(s.db)
	if err != nil {
		return nil, err
	}

	manifest := &dto.BackupManifest{
		FormatVersion: dto.BackupFormatVersion,
		CreatedAt:     time.Now(),
		CreatedBy:     operator,
		AppName:       s.cfg.App.Name,
		AppEnv:        s.cfg.App.Env,
		DBDriver:      s.driver(),
		DBName:        s.cfg.Database.Name,
		Note:          note,
		WithUploads:   withUploads,
	}

	driver := s.driver()
	for _, t := range tables {
		if !s.db.Migrator().HasTable(t) {
			continue
		}
		entry, err := zw.Create(backupDataPrefix + t + ".jsonl")
		if err != nil {
			return nil, err
		}
		rows, err := dumpTable(s.db, driver, t, entry)
		if err != nil {
			return nil, err
		}
		manifest.Tables = append(manifest.Tables, dto.BackupTableStat{Name: t, Rows: rows})
		manifest.TotalRows += rows
	}

	if withUploads {
		files, bytes, err := s.writeUploads(zw)
		if err != nil {
			return nil, err
		}
		manifest.UploadFiles = files
		manifest.UploadBytes = bytes
	}

	// manifest 最后写入：此时表行数与附件统计才齐全。zip 通过中央目录索引，条目顺序不影响读取。
	mf, err := zw.Create(backupManifestName)
	if err != nil {
		return nil, err
	}
	enc := json.NewEncoder(mf)
	enc.SetIndent("", "  ")
	if err := enc.Encode(manifest); err != nil {
		return nil, err
	}

	if err := zw.Close(); err != nil {
		return nil, err
	}
	return manifest, nil
}

// writeUploads 把上传目录下的文件写入归档的 uploads/ 前缀。
func (s *BackupService) writeUploads(zw *zip.Writer) (int, int64, error) {
	root := strings.TrimSpace(s.cfg.Upload.Dir)
	if root == "" {
		return 0, 0, nil
	}
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return 0, 0, err
	}
	if _, err := os.Stat(rootAbs); errors.Is(err, os.ErrNotExist) {
		return 0, 0, nil
	}
	// 备份目录若被配置在上传目录内，跳过它，避免把历史归档层层套娃。
	backupAbs, _ := filepath.Abs(s.dir())

	var count int
	var total int64
	err = filepath.WalkDir(rootAbs, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if p == backupAbs {
				return filepath.SkipDir
			}
			return nil
		}
		if !d.Type().IsRegular() {
			return nil
		}
		rel, err := filepath.Rel(rootAbs, p)
		if err != nil {
			return err
		}
		src, err := os.Open(p)
		if err != nil {
			return err
		}
		defer src.Close()

		dst, err := zw.Create(backupUploadPrefix + filepath.ToSlash(rel))
		if err != nil {
			return err
		}
		n, err := io.Copy(dst, src)
		if err != nil {
			return err
		}
		count++
		total += n
		return nil
	})
	if err != nil {
		return 0, 0, fmt.Errorf("打包附件失败: %w", err)
	}
	return count, total, nil
}

// ===== 查询 / 下载 / 删除 =====

// List 列出备份目录下的归档，按创建时间倒序。
func (s *BackupService) List() ([]dto.BackupItem, error) {
	dir := s.dir()
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) {
		return []dto.BackupItem{}, nil
	}
	if err != nil {
		return nil, err
	}

	items := make([]dto.BackupItem, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || !backupNamePattern.MatchString(e.Name()) {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		item := dto.BackupItem{
			Name:      e.Name(),
			Size:      info.Size(),
			CreatedAt: info.ModTime(),
		}
		manifest, err := readManifest(filepath.Join(dir, e.Name()))
		if err != nil {
			item.Invalid = true
			item.Reason = err.Error()
		} else {
			item.Manifest = manifest
			item.CreatedAt = manifest.CreatedAt
		}
		items = append(items, item)
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})
	return items, nil
}

// Locate 校验文件名后返回归档的绝对路径，供 handler 流式下载。
func (s *BackupService) Locate(name string) (string, error) {
	if !backupNamePattern.MatchString(name) {
		return "", NewValidationError("备份文件名不合法")
	}
	p := filepath.Join(s.dir(), name)
	info, err := os.Stat(p)
	if errors.Is(err, os.ErrNotExist) || (err == nil && info.IsDir()) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	return p, nil
}

// Delete 删除指定归档。
func (s *BackupService) Delete(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	p, err := s.Locate(name)
	if err != nil {
		return err
	}
	return os.Remove(p)
}

// prune 按 max_keep 清理最旧的归档；max_keep 为 0 表示不限制。
func (s *BackupService) prune() {
	keep := s.cfg.Backup.MaxKeep
	if keep <= 0 {
		return
	}
	items, err := s.List()
	if err != nil || len(items) <= keep {
		return
	}
	for _, item := range items[keep:] {
		os.Remove(filepath.Join(s.dir(), item.Name))
	}
}

// ===== 恢复 =====

// RestoreFromStored 用备份目录中已有的归档执行恢复。
func (s *BackupService) RestoreFromStored(operator, name string) (*dto.RestoreResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	p, err := s.Locate(name)
	if err != nil {
		return nil, err
	}
	return s.restore(operator, p, name)
}

// RestoreFromUpload 用管理员上传的归档执行恢复。归档先落到临时文件再解析。
func (s *BackupService) RestoreFromUpload(operator, filename string, r io.Reader, size int64) (*dto.RestoreResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if maxMB := s.cfg.Backup.MaxUploadMB; maxMB > 0 && size > int64(maxMB)*1024*1024 {
		return nil, NewValidationError(fmt.Sprintf("备份文件超过大小限制（最大 %d MB）", maxMB))
	}
	if !strings.HasSuffix(strings.ToLower(filename), backupFileExt) {
		return nil, NewValidationError("请上传本系统导出的 .zip 备份文件")
	}
	if err := os.MkdirAll(s.dir(), 0o750); err != nil {
		return nil, err
	}

	tmp, err := os.CreateTemp(s.dir(), ".upload-*"+backupFileExt)
	if err != nil {
		return nil, err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)

	if _, err := io.Copy(tmp, r); err != nil {
		tmp.Close()
		return nil, fmt.Errorf("接收备份文件失败: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return nil, err
	}
	return s.restore(operator, tmpPath, filename)
}

// restore 执行恢复：校验归档 → 自动留一份回滚备份 → 事务内重建数据 → 还原附件。
func (s *BackupService) restore(operator, archivePath, sourceName string) (*dto.RestoreResult, error) {
	zr, err := zip.OpenReader(archivePath)
	if err != nil {
		return nil, NewValidationError("备份文件无法解析，可能已损坏或不是 zip 归档")
	}
	defer zr.Close()

	manifest, err := manifestFromZip(&zr.Reader)
	if err != nil {
		return nil, NewValidationError(err.Error())
	}
	if manifest.FormatVersion > dto.BackupFormatVersion {
		return nil, NewValidationError(fmt.Sprintf(
			"备份格式版本 %d 高于当前系统支持的 %d，请升级后再恢复",
			manifest.FormatVersion, dto.BackupFormatVersion))
	}
	if manifest.DBDriver != "" && manifest.DBDriver != s.driver() {
		return nil, NewValidationError(fmt.Sprintf(
			"备份来自 %s 数据库，与当前 %s 不一致，无法恢复",
			manifest.DBDriver, s.driver()))
	}

	// 恢复是破坏性操作，先留一份当前数据的回滚点。
	safety, err := s.create(operator, dto.CreateBackupRequest{
		Note: "恢复前自动备份（来源：" + sourceName + "）",
	}, preRestoreFilePrefix)
	if err != nil {
		return nil, fmt.Errorf("恢复前自动备份失败，已中止恢复: %w", err)
	}

	result := &dto.RestoreResult{Source: sourceName, SafetyBackup: safety.Name}
	if err := s.restoreDatabase(&zr.Reader, result); err != nil {
		return nil, err
	}
	if manifest.WithUploads {
		files, err := s.restoreUploads(&zr.Reader)
		if err != nil {
			return nil, err
		}
		result.RestoredFiles = files
		result.UploadsReplaced = true
	}
	return result, nil
}

// restoreDatabase 在单个事务内清空并重建所有表，任一步失败即整体回滚。
func (s *BackupService) restoreDatabase(zr *zip.Reader, result *dto.RestoreResult) error {
	driver := s.driver()

	// 归档里的表按外键依赖排序，被引用的表先写。
	byTable := map[string]*zip.File{}
	for _, f := range zr.File {
		name := f.Name
		if !strings.HasPrefix(name, backupDataPrefix) || !strings.HasSuffix(name, ".jsonl") {
			continue
		}
		table := strings.TrimSuffix(strings.TrimPrefix(name, backupDataPrefix), ".jsonl")
		if table == "" || strings.Contains(table, "/") {
			continue
		}
		byTable[table] = f
	}
	if len(byTable) == 0 {
		return NewValidationError("备份文件不含任何数据表，无法恢复")
	}

	present := make([]string, 0, len(byTable))
	for t := range byTable {
		if s.db.Migrator().HasTable(t) {
			present = append(present, t)
		} else {
			result.SkippedTables = append(result.SkippedTables, t)
		}
	}
	sort.Strings(present)
	sort.Strings(result.SkippedTables)
	ordered := sortTablesByDependency(s.db, driver, present)

	// 当前库里存在、但归档中没有的表也要清空，否则恢复出来的不是「那一刻的全量数据」。
	allTables, err := tableNamesFromModels(s.db)
	if err != nil {
		return err
	}
	toTruncate := make([]string, 0, len(allTables))
	seen := map[string]struct{}{}
	for _, t := range append(append([]string{}, ordered...), allTables...) {
		if _, ok := seen[t]; ok {
			continue
		}
		if !s.db.Migrator().HasTable(t) {
			continue
		}
		seen[t] = struct{}{}
		toTruncate = append(toTruncate, t)
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := truncateAll(tx, driver, toTruncate); err != nil {
			return fmt.Errorf("清空原有数据失败: %w", err)
		}
		for _, t := range ordered {
			rows, err := restoreTableFromZip(tx, driver, t, byTable[t])
			if err != nil {
				return err
			}
			result.RestoredTables++
			result.RestoredRows += rows
		}
		return resetSequences(tx, driver, toTruncate)
	})
}

// restoreTableFromZip 流式读取一张表的 JSONL 并分批写入，避免整表驻留内存。
func restoreTableFromZip(tx *gorm.DB, driver, table string, f *zip.File) (int64, error) {
	rc, err := f.Open()
	if err != nil {
		return 0, err
	}
	defer rc.Close()

	dec := json.NewDecoder(rc)
	dec.UseNumber()

	var header backupTableHeader
	if err := dec.Decode(&header); err != nil {
		return 0, NewValidationError(fmt.Sprintf("备份中表 %s 的数据格式无法解析", table))
	}

	existing, err := tableColumns(tx, driver, table)
	if err != nil {
		return 0, err
	}
	// 归档里已从模型中删除的列直接忽略，保证旧备份仍可恢复到新版本。
	cols := make([]backupColumn, 0, len(header.Columns))
	for _, c := range header.Columns {
		if _, ok := existing[c.Name]; ok {
			cols = append(cols, c)
		}
	}
	if len(cols) == 0 {
		return 0, nil
	}

	var written int64
	buf := make([][]any, 0, maxRowsPerInsert)
	flush := func() error {
		if len(buf) == 0 {
			return nil
		}
		if err := insertRows(tx, driver, table, cols, buf); err != nil {
			return err
		}
		written += int64(len(buf))
		buf = buf[:0]
		return nil
	}

	for dec.More() {
		var record map[string]any
		if err := dec.Decode(&record); err != nil {
			return 0, NewValidationError(fmt.Sprintf("备份中表 %s 第 %d 行无法解析", table, written+int64(len(buf))+1))
		}
		values := make([]any, len(cols))
		for i, c := range cols {
			v, err := decodeRestoreValue(record[c.Name], c.Type)
			if err != nil {
				return 0, NewValidationError(fmt.Sprintf("表 %s 列 %s 数据异常: %v", table, c.Name, err))
			}
			values[i] = v
		}
		buf = append(buf, values)
		if len(buf) >= maxRowsPerInsert {
			if err := flush(); err != nil {
				return 0, err
			}
		}
	}
	if err := flush(); err != nil {
		return 0, err
	}
	return written, nil
}

// restoreUploads 用归档中的附件整体替换上传目录，原目录改名保留以便人工回退。
func (s *BackupService) restoreUploads(zr *zip.Reader) (int, error) {
	root := strings.TrimSpace(s.cfg.Upload.Dir)
	if root == "" {
		return 0, nil
	}
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return 0, err
	}
	parent := filepath.Dir(rootAbs)
	if err := os.MkdirAll(parent, 0o750); err != nil {
		return 0, err
	}

	staging, err := os.MkdirTemp(parent, ".uploads-restore-*")
	if err != nil {
		return 0, err
	}
	defer os.RemoveAll(staging)

	count := 0
	for _, f := range zr.File {
		if !strings.HasPrefix(f.Name, backupUploadPrefix) || strings.HasSuffix(f.Name, "/") {
			continue
		}
		rel := strings.TrimPrefix(f.Name, backupUploadPrefix)
		dst, err := safeJoin(staging, rel)
		if err != nil {
			return 0, err
		}
		if err := os.MkdirAll(filepath.Dir(dst), 0o750); err != nil {
			return 0, err
		}
		if err := extractZipFile(f, dst); err != nil {
			return 0, err
		}
		count++
	}

	backupOld := rootAbs + ".replaced-" + time.Now().Format(backupTimeLayout)
	if _, err := os.Stat(rootAbs); err == nil {
		if err := os.Rename(rootAbs, backupOld); err != nil {
			return 0, fmt.Errorf("备份原附件目录失败: %w", err)
		}
	}
	if err := os.Rename(staging, rootAbs); err != nil {
		// 换入失败则把原目录搬回来，不留下空的上传目录。
		os.Rename(backupOld, rootAbs)
		return 0, fmt.Errorf("还原附件目录失败: %w", err)
	}
	return count, nil
}

func extractZipFile(f *zip.File, dst string) error {
	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer rc.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o640)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, rc)
	return err
}

// safeJoin 拒绝归档中带 .. 的条目，防止解压时写出目录之外；绝对路径按相对路径处理。
func safeJoin(base, rel string) (string, error) {
	slashed := strings.ReplaceAll(rel, `\`, "/")
	// 在 path.Clean 抹平 .. 之前先拦截，避免把越权路径悄悄改写成合法路径。
	for _, seg := range strings.Split(slashed, "/") {
		if seg == ".." {
			return "", NewValidationError("备份文件包含非法路径: " + rel)
		}
	}
	cleaned := strings.TrimPrefix(path.Clean("/"+slashed), "/")
	if cleaned == "" || cleaned == "." {
		return "", NewValidationError("备份文件包含非法路径: " + rel)
	}
	return filepath.Join(base, filepath.FromSlash(cleaned)), nil
}

// ===== manifest 读取 =====

func readManifest(archivePath string) (*dto.BackupManifest, error) {
	zr, err := zip.OpenReader(archivePath)
	if err != nil {
		return nil, errors.New("文件无法解析为 zip 归档")
	}
	defer zr.Close()
	return manifestFromZip(&zr.Reader)
}

func manifestFromZip(zr *zip.Reader) (*dto.BackupManifest, error) {
	f, err := zr.Open(backupManifestName)
	if err != nil {
		return nil, errors.New("缺少 manifest.json，不是本系统生成的备份")
	}
	defer f.Close()

	var m dto.BackupManifest
	if err := json.NewDecoder(f).Decode(&m); err != nil {
		return nil, errors.New("manifest.json 解析失败")
	}
	return &m, nil
}
