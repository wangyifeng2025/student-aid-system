"use client";

import * as React from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { importApi, ApiError } from "@/lib/api";
import type { ImportKind } from "@/lib/api";
import type { ImportResult } from "@/types/student";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { TransferProgress } from "@/components/ui/transfer-progress";
import { estimatedPercent, useElapsed } from "@/hooks/use-elapsed";

interface ImportDialogProps {
  open: boolean;
  kind: ImportKind;
  title: string;
  hint: string;
  onClose: () => void;
  onImported: () => void;
}

async function runImport(kind: ImportKind, file: File): Promise<ImportResult> {
  switch (kind) {
    case "students":
      return importApi.importStudents(file);
    case "special-groups":
      return importApi.importSpecialGroups(file);
    case "departments":
      return importApi.importDepartments(file);
    case "majors":
      return importApi.importMajors(file);
    case "grades":
      return importApi.importGrades(file);
    case "classes":
      return importApi.importClasses(file);
    case "advisors":
      return importApi.importAdvisors(file);
    case "users":
      return importApi.importUsers(file);
  }
}

export function ImportDialog({
  open,
  kind,
  title,
  hint,
  onClose,
  onImported,
}: ImportDialogProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const busy = importing || downloading;
  const elapsed = useElapsed(busy);

  // 每次打开重置状态：用渲染期状态调整（替代 effect，避免级联渲染）。
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setFile(null);
      setResult(null);
      setImporting(false);
    }
  }

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await importApi.downloadTemplate(kind);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "模板下载失败");
    } finally {
      setDownloading(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("请先选择 Excel 文件");
      return;
    }
    setImporting(true);
    setResult(null);
    try {
      const res = await runImport(kind, file);
      setResult(res);
      if (res.failed === 0) {
        toast.success(`导入完成：成功 ${res.success} 条`);
      } else {
        toast.error(`导入完成：成功 ${res.success} 条，失败 ${res.failed} 条`);
      }
      onImported();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "导入失败");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      size="lg"
      closable={!busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            关闭
          </Button>
          <Button size="sm" onClick={handleImport} disabled={busy || !file}>
            <Upload size={16} />
            {importing ? "导入中…" : "开始导入"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-soft">{hint}</p>
        {busy ? (
          <TransferProgress
            percent={estimatedPercent(elapsed, importing ? 28 : 8)}
            elapsed={elapsed}
            title={importing ? "正在导入，请稍候" : "正在下载模板"}
            hint={
              importing
                ? "行数较多时可能需要一两分钟，请勿关闭页面或重复点击。"
                : "正在准备 Excel 模板…"
            }
            detail={importing && file ? file.name : undefined}
          />
        ) : null}

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={busy}>
            <Download size={16} />
            {downloading ? "下载中…" : "下载导入模板"}
          </Button>
          <span className="text-xs text-ink-mute">请基于模板填写后再上传</span>
        </div>

        {/* 文件选择 */}
        <div
          className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-line bg-page px-4 py-3 transition-colors hover:border-brand"
          onClick={() => {
            if (!busy) inputRef.current?.click();
          }}
          role="button"
        >
          <FileSpreadsheet size={20} className="text-ink-mute" />
          <div className="min-w-0 flex-1">
            {file ? (
              <span className="block truncate text-sm text-ink">{file.name}</span>
            ) : (
              <span className="text-sm text-ink-mute">点击选择 .xlsx 文件</span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
        </div>

        {/* 导入结果回显 */}
        {result && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge tone="neutral">总计 {result.total}</Badge>
              <Badge tone="success">成功 {result.success}</Badge>
              <Badge tone={result.failed > 0 ? "error" : "neutral"}>
                失败 {result.failed}
              </Badge>
            </div>

            {result.errors.length > 0 && (
              <div className="overflow-hidden rounded-md border border-line">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <th className="px-3 py-2 text-left font-medium text-ink-mute" style={{ width: 70 }}>
                          行号
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-ink-mute" style={{ width: 120 }}>
                          列
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-ink-mute">错误原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((err, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                          <td className="px-3 py-2 tabular-nums text-ink-soft">{err.row}</td>
                          <td className="px-3 py-2 text-ink-soft">{err.column || "—"}</td>
                          <td className="px-3 py-2" style={{ color: "var(--state-error)" }}>
                            {err.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
