"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { exportApi, importApi, ApiError } from "@/lib/api";
import type { OrgSpreadsheetKind } from "@/lib/api";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { FileTransferOverlay } from "@/components/ui/file-transfer-overlay";
import { ImportDialog } from "@/components/student/import-dialog";
import { ExportButtons, type ExportScope } from "@/components/base-data/export-menu";

interface OrgSpreadsheetActionsProps {
  kind: OrgSpreadsheetKind;
  importTitle: string;
  importHint: string;
  onDone: () => void;
  /** 当前是否设置了筛选条件（用于决定是否显示「导出筛选」） */
  hasFilter?: boolean;
  /** 当前勾选的 ID 集合（用于「导出勾选」） */
  selectedIds?: Set<number>;
  /** 导出筛选数据时的查询参数构造 */
  buildFilterParams?: () => Record<string, string | number | boolean | undefined>;
}

const exportLabels: Record<OrgSpreadsheetKind, string> = {
  departments: "院系",
  majors: "专业",
  grades: "年级",
  classes: "班级",
};

export function OrgSpreadsheetActions({
  kind,
  importTitle,
  importHint,
  onDone,
  hasFilter = false,
  selectedIds,
  buildFilterParams,
}: OrgSpreadsheetActionsProps) {
  const [importOpen, setImportOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const handleExport = async (scope: ExportScope) => {
    const selectedCount = selectedIds?.size ?? 0;
    if (scope === "selected" && selectedCount === 0) {
      toast.info(`请先勾选要导出的${exportLabels[kind]}`);
      return;
    }
    setExporting(true);
    try {
      if (scope === "all") {
        await exportApi.org(kind);
      } else if (scope === "filtered") {
        await exportApi.org(kind, { filter: buildFilterParams?.() });
      } else {
        const ids = selectedIds ? Array.from(selectedIds) : [];
        await exportApi.org(kind, { ids });
      }
      toast.success(`${exportLabels[kind]}数据已导出`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <ExportButtons
        onExport={handleExport}
        exporting={exporting}
        selectedCount={selectedIds?.size ?? 0}
        hasFilter={hasFilter}
        label="导出"
      />
      <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
        <Upload size={16} />
        导入 Excel
      </Button>

      <ImportDialog
        open={importOpen}
        kind={kind}
        title={importTitle}
        hint={importHint}
        onClose={() => setImportOpen(false)}
        onImported={onDone}
      />
      <FileTransferOverlay
        open={exporting}
        title={`正在导出${exportLabels[kind]}数据`}
        hint="数据较多时请耐心等待，系统仍在生成 Excel，请勿关闭页面。"
        tauSeconds={22}
      />
    </>
  );
}
