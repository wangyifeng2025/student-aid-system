"use client";

import * as React from "react";
import { AlertTriangle, Download, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { backupApi, ApiError } from "@/lib/api";
import type { BackupItem, RestoreResult } from "@/types/backup";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toolbar } from "@/components/base-data/toolbar";
import { DataTable, CellText, type Column } from "@/components/base-data/data-table";

/** 输入该词才允许执行恢复，避免误点导致全库被覆盖。 */
const RESTORE_CONFIRM_WORD = "恢复";

export default function BackupsPage() {
  const logout = useAuthStore((s) => s.logout);

  const [list, setList] = React.useState<BackupItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [creating, setCreating] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [withUploads, setWithUploads] = React.useState(true);

  const [deleteTarget, setDeleteTarget] = React.useState<BackupItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const [restoreTarget, setRestoreTarget] = React.useState<BackupItem | null>(null);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [confirmWord, setConfirmWord] = React.useState("");
  const [restoring, setRestoring] = React.useState(false);
  const [result, setResult] = React.useState<RestoreResult | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 状态只在 Promise 回调里更新，effect 内不同步 setState。
  const load = React.useCallback(
    () =>
      backupApi
        .list()
        .then((items) => {
          setList(items);
          setError(null);
        })
        .catch((e) => setError(e instanceof ApiError ? e.message : "加载失败"))
        .finally(() => setLoading(false)),
    [],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const reload = React.useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const item = await backupApi.create({
        note: note.trim() || undefined,
        with_uploads: withUploads,
      });
      toast.success(
        `备份完成：${item.manifest?.total_rows ?? 0} 条记录、${item.manifest?.upload_files ?? 0} 个附件`,
      );
      setCreateOpen(false);
      setNote("");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "备份失败");
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (item: BackupItem) => {
    try {
      await backupApi.download(item.name);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "下载失败");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await backupApi.remove(deleteTarget.name);
      toast.success("已删除备份");
      setDeleteTarget(null);
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const closeRestoreDialog = () => {
    setRestoreTarget(null);
    setUploadFile(null);
    setConfirmWord("");
  };

  const handleRestore = async () => {
    if (!uploadFile && !restoreTarget) return;
    setRestoring(true);
    try {
      const res = uploadFile
        ? await backupApi.restoreUpload(uploadFile)
        : await backupApi.restore(restoreTarget!.name);
      closeRestoreDialog();
      setResult(res);
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "恢复失败");
    } finally {
      setRestoring(false);
    }
  };

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setRestoreTarget(null);
    setConfirmWord("");
    setUploadFile(file);
  };

  const columns: Column<BackupItem>[] = [
    {
      header: "备份文件",
      width: "260px",
      cell: (b) => (
        <div className="min-w-0">
          <CellText className="font-medium text-ink">{b.name}</CellText>
          {b.invalid ? (
            <span className="text-xs text-error">{b.reason || "文件损坏"}</span>
          ) : (
            b.manifest?.note && (
              <CellText className="text-xs text-ink-mute">{b.manifest.note}</CellText>
            )
          )}
        </div>
      ),
    },
    {
      header: "备份时间",
      width: "170px",
      cell: (b) => <CellText>{formatDateTime(b.created_at)}</CellText>,
    },
    {
      header: "数据量",
      width: "110px",
      align: "right",
      cell: (b) =>
        b.manifest ? (
          <CellText>{b.manifest.total_rows.toLocaleString()} 条</CellText>
        ) : (
          <CellText>—</CellText>
        ),
    },
    {
      header: "附件",
      width: "110px",
      align: "right",
      cell: (b) => {
        if (!b.manifest) return <CellText>—</CellText>;
        if (!b.manifest.with_uploads) {
          return <Badge tone="warning">未包含</Badge>;
        }
        return <CellText>{b.manifest.upload_files} 个</CellText>;
      },
    },
    {
      header: "文件大小",
      width: "110px",
      align: "right",
      cell: (b) => <CellText>{formatBytes(b.size)}</CellText>,
    },
    {
      header: "操作人",
      width: "150px",
      cell: (b) => <CellText>{b.manifest?.created_by || "—"}</CellText>,
    },
    {
      header: "操作",
      width: "220px",
      align: "right",
      cell: (b) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleDownload(b)}>
            <Download size={15} />
            下载
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={b.invalid}
            onClick={() => {
              setUploadFile(null);
              setConfirmWord("");
              setRestoreTarget(b);
            }}
          >
            <RotateCcw size={15} />
            恢复
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(b)}>
            <Trash2 size={15} />
          </Button>
        </div>
      ),
    },
  ];

  const restoreOpen = restoreTarget !== null || uploadFile !== null;
  const restoreSourceName = uploadFile?.name ?? restoreTarget?.name ?? "";
  const canConfirmRestore = confirmWord.trim() === RESTORE_CONFIRM_WORD;

  return (
    <div className="min-w-0">
      <section
        className="mb-4 flex gap-3 p-4"
        style={{
          backgroundColor: "var(--state-info-bg)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: "var(--state-info)" }} />
        <div className="space-y-1 text-sm text-ink-soft">
          <p>
            备份包含<strong>全部业务数据表</strong>与<strong>学生上传的附件</strong>，
            打包为单个 zip 文件保存在服务器的备份目录中。
          </p>
          <p>
            服务器硬件损坏会连同备份目录一起丢失，请定期点击「下载」把备份保存到本机或云盘；
            在新服务器上可用「上传备份并恢复」重建整套数据。
          </p>
        </div>
      </section>

      <Toolbar>
        <div className="text-sm text-ink-mute">
          共 {list.length} 份备份
          {list[0] && !list[0].invalid && (
            <>，最近一次于 {formatDateTime(list[0].created_at)}</>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Save size={16} />
            立即备份
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} />
            上传备份并恢复
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handlePickFile}
          />
        </div>
      </Toolbar>

      <DataTable
        columns={columns}
        data={list}
        rowKey={(b) => b.name}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyLabel="暂无备份，建议先点击「立即备份」"
      />

      <Modal
        open={createOpen}
        title="创建全量备份"
        onClose={() => setCreateOpen(false)}
        closable={!creating}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)} disabled={creating}>
              取消
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating ? "备份中…" : "开始备份"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="backup-note">备注（选填）</Label>
            <Input
              id="backup-note"
              value={note}
              maxLength={100}
              placeholder="如：2026 年认定工作结束"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={withUploads}
              onChange={(e) => setWithUploads(e.target.checked)}
            />
            <span>
              同时备份学生上传的附件
              <span className="block text-xs text-ink-mute">
                取消勾选可显著减小文件体积，但恢复后证明材料等附件会缺失
              </span>
            </span>
          </label>
        </div>
      </Modal>

      <Modal
        open={restoreOpen}
        title="恢复数据"
        onClose={closeRestoreDialog}
        closable={!restoring}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeRestoreDialog} disabled={restoring}>
              取消
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleRestore}
              disabled={restoring || !canConfirmRestore}
            >
              {restoring ? "恢复中，请勿关闭页面…" : "确认恢复"}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <p className="text-ink-soft">
            即将用 <span className="font-medium text-ink">{restoreSourceName}</span> 覆盖当前所有数据。
          </p>
          <ul className="list-disc space-y-1 pl-5 text-ink-soft">
            <li>当前数据库中的全部业务数据将被清空，再按备份内容重建。</li>
            <li>备份之后新增的学生、申请、审核记录与附件都会消失。</li>
            <li>系统会先自动生成一份「恢复前备份」，万一恢复错了还能退回去。</li>
            <li>若备份中的账号与当前不同，恢复后可能需要重新登录。</li>
          </ul>
          <div className="space-y-1.5">
            <Label htmlFor="restore-confirm">
              请输入「{RESTORE_CONFIRM_WORD}」以确认
            </Label>
            <Input
              id="restore-confirm"
              value={confirmWord}
              placeholder={RESTORE_CONFIRM_WORD}
              disabled={restoring}
              onChange={(e) => setConfirmWord(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={result !== null}
        title="恢复完成"
        onClose={() => setResult(null)}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
              知道了
            </Button>
            <Button size="sm" onClick={logout}>
              重新登录
            </Button>
          </>
        }
      >
        {result && (
          <div className="space-y-3 text-sm text-ink-soft">
            <p>
              已从 <span className="font-medium text-ink">{result.source}</span> 恢复
              {" "}{result.restored_tables} 张表、{result.restored_rows.toLocaleString()} 条记录
              {result.uploads_replaced && <>，以及 {result.restored_files} 个附件</>}。
            </p>
            <p>
              恢复前的数据已保存为{" "}
              <span className="font-medium text-ink">{result.safety_backup}</span>，
              如需退回可直接对它执行恢复。
            </p>
            {result.skipped_tables && result.skipped_tables.length > 0 && (
              <p style={{ color: "var(--state-warning)" }}>
                以下表在当前版本中已不存在，未恢复：{result.skipped_tables.join("、")}
              </p>
            )}
            <p>建议重新登录，以确保当前账号信息与恢复后的数据一致。</p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除备份"
        description={`确定删除备份「${deleteTarget?.name ?? ""}」吗？删除后无法从服务器恢复该时间点的数据。`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
