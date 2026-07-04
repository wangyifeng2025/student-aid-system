"use client";

import * as React from "react";
import { Download, Upload } from "lucide-react";
import { exportApi, importApi, ApiError } from "@/lib/api";
import type { OrgSpreadsheetKind } from "@/lib/api";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { ImportDialog } from "@/components/student/import-dialog";

interface OrgSpreadsheetActionsProps {
  kind: OrgSpreadsheetKind;
  importTitle: string;
  importHint: string;
  onDone: () => void;
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
}: OrgSpreadsheetActionsProps) {
  const [importOpen, setImportOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportApi.org(kind);
      toast.success(`${exportLabels[kind]}数据已导出`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
        <Download size={16} />
        {exporting ? "导出中…" : "导出 Excel"}
      </Button>
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
    </>
  );
}
