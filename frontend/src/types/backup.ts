/** 归档中单张表的导出统计。 */
export interface BackupTableStat {
  name: string;
  rows: number;
}

/** 归档内 manifest.json 的内容。 */
export interface BackupManifest {
  format_version: number;
  created_at: string;
  created_by: string;
  app_name: string;
  app_env: string;
  db_driver: string;
  db_name: string;
  note: string;
  tables: BackupTableStat[] | null;
  total_rows: number;
  with_uploads: boolean;
  upload_files: number;
  upload_bytes: number;
}

/** 备份目录中的一个归档文件。invalid 为 true 时 manifest 不可读。 */
export interface BackupItem {
  name: string;
  size: number;
  created_at: string;
  manifest?: BackupManifest;
  invalid: boolean;
  reason?: string;
}

export interface CreateBackupInput {
  note?: string;
  with_uploads?: boolean;
}

export interface RestoreResult {
  source: string;
  restored_tables: number;
  restored_rows: number;
  restored_files: number;
  uploads_replaced: boolean;
  safety_backup: string;
  skipped_tables?: string[];
}
