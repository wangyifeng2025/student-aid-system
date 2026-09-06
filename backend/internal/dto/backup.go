package dto

import "time"

// ===== 数据备份与恢复 Backup =====

// BackupFormatVersion 归档格式版本。恢复时会校验，避免用新格式的包回滚到旧程序。
const BackupFormatVersion = 1

// BackupTableStat 归档中单张表的导出统计。
type BackupTableStat struct {
	Name string `json:"name"`
	Rows int64  `json:"rows"`
}

// BackupManifest 归档内 manifest.json 的内容，描述这份备份「是什么、含多少数据」。
type BackupManifest struct {
	FormatVersion int               `json:"format_version"`
	CreatedAt     time.Time         `json:"created_at"`
	CreatedBy     string            `json:"created_by"`
	AppName       string            `json:"app_name"`
	AppEnv        string            `json:"app_env"`
	DBDriver      string            `json:"db_driver"`
	DBName        string            `json:"db_name"`
	Note          string            `json:"note"`
	Tables        []BackupTableStat `json:"tables"`
	TotalRows     int64             `json:"total_rows"`
	WithUploads   bool              `json:"with_uploads"`
	UploadFiles   int               `json:"upload_files"`
	UploadBytes   int64             `json:"upload_bytes"`
}

// BackupItem 备份目录中的一个归档文件。Manifest 为空表示文件损坏或非本系统生成。
type BackupItem struct {
	Name      string          `json:"name"`
	Size      int64           `json:"size"`
	CreatedAt time.Time       `json:"created_at"`
	Manifest  *BackupManifest `json:"manifest,omitempty"`
	Invalid   bool            `json:"invalid"`
	Reason    string          `json:"reason,omitempty"`
}

// CreateBackupRequest 创建备份的入参。WithUploads 为空指针时默认连同附件一起打包。
type CreateBackupRequest struct {
	Note        string `json:"note"`
	WithUploads *bool  `json:"with_uploads"`
}

// RestoreResult 恢复结果概要。
type RestoreResult struct {
	Source          string   `json:"source"`
	RestoredTables  int      `json:"restored_tables"`
	RestoredRows    int64    `json:"restored_rows"`
	RestoredFiles   int      `json:"restored_files"`
	UploadsReplaced bool     `json:"uploads_replaced"`
	SafetyBackup    string   `json:"safety_backup"`
	SkippedTables   []string `json:"skipped_tables,omitempty"`
}
