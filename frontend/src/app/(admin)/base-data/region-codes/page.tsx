"use client";

import * as React from "react";
import { ChevronRight, Plus, Search, Upload } from "lucide-react";
import { regionCodeApi, ApiError } from "@/lib/api";
import type { RegionCode, RegionLookup } from "@/types/region";
import { REGION_LEVEL_LABEL } from "@/types/region";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toolbar } from "@/components/base-data/toolbar";
import { DataTable, type Column } from "@/components/base-data/data-table";
import { RowActions } from "@/components/base-data/row-actions";

interface Crumb {
  code: string;
  name: string;
}

export default function RegionCodesPage() {
  const canWrite = useAuthStore((s) => s.user?.role === "admin");

  const [crumbs, setCrumbs] = React.useState<Crumb[]>([]);
  const [list, setList] = React.useState<RegionCode[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [keyword, setKeyword] = React.useState("");
  const [appliedKeyword, setAppliedKeyword] = React.useState("");

  const [lookupQ, setLookupQ] = React.useState("");
  const [lookup, setLookup] = React.useState<RegionLookup | null>(null);
  const [lookupErr, setLookupErr] = React.useState<string | null>(null);
  const [looking, setLooking] = React.useState(false);

  const [editing, setEditing] = React.useState<RegionCode | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [typ, setTyp] = React.useState("");
  const [level, setLevel] = React.useState("1");
  const [sort, setSort] = React.useState("0");
  const [submitting, setSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<RegionCode | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const [importOpen, setImportOpen] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const parent = crumbs[crumbs.length - 1];

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await regionCodeApi.list({
        parent_code: appliedKeyword ? undefined : parent?.code,
        keyword: appliedKeyword || undefined,
      });
      setList(items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [parent?.code, appliedKeyword]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setCode("");
    setName("");
    setTyp("");
    setLevel(String(Math.min(3, crumbs.length + 1)));
    setSort(String(list.length));
    setFormOpen(true);
  };

  const openEdit = (it: RegionCode) => {
    setEditing(it);
    setCode(it.code);
    setName(it.name);
    setTyp(it.type);
    setLevel(String(it.level));
    setSort(String(it.sort));
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!editing && !code.trim()) {
      toast.error("请填写区划代码");
      return;
    }
    if (!name.trim()) {
      toast.error("请填写区划名称");
      return;
    }
    const lv = Number(level);
    if (lv < 1 || lv > 3) {
      toast.error("级别须为 1 / 2 / 3");
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await regionCodeApi.update(editing.code, {
          name: name.trim(),
          level: lv,
          type: typ.trim(),
          parent_code: editing.parent_code || undefined,
          sort: Number(sort) || 0,
        });
        toast.success("已更新行政区划");
      } else {
        await regionCodeApi.create({
          code: code.trim(),
          name: name.trim(),
          level: lv,
          type: typ.trim(),
          parent_code: parent?.code,
          sort: Number(sort) || 0,
        });
        toast.success("已新增行政区划");
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await regionCodeApi.remove(deleteTarget.code);
      toast.success("已删除行政区划");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const handleLookup = async () => {
    if (!lookupQ.trim()) {
      toast.error("请输入身份证号或 6 位区划代码");
      return;
    }
    setLooking(true);
    setLookupErr(null);
    try {
      setLookup(await regionCodeApi.lookup(lookupQ.trim()));
    } catch (e) {
      setLookup(null);
      setLookupErr(e instanceof ApiError ? e.message : "未能解析地址");
    } finally {
      setLooking(false);
    }
  };

  const handleImportDefault = async () => {
    setImporting(true);
    try {
      const res = await regionCodeApi.importDefault();
      toast.success(`已导入内置区划：新增 ${res.created}，更新 ${res.updated}，跳过 ${res.skipped}`);
      setImportOpen(false);
      setCrumbs([]);
      setAppliedKeyword("");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "导入失败");
    } finally {
      setImporting(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const res = await regionCodeApi.importTree(raw);
      toast.success(`已导入 JSON：新增 ${res.created}，更新 ${res.updated}，跳过 ${res.skipped}`);
      setCrumbs([]);
      setAppliedKeyword("");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "JSON 无效或导入失败");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const columns: Column<RegionCode>[] = [
    { header: "名称", cell: (it) => <span className="text-ink">{it.name}</span> },
    { header: "区划代码", cell: (it) => <span className="font-mono text-ink-soft">{it.code}</span> },
    { header: "身份证前6位", width: "120px", cell: (it) => <span className="font-mono tabular-nums">{it.id_prefix}</span> },
    { header: "级别", width: "80px", cell: (it) => REGION_LEVEL_LABEL[it.level] ?? it.level },
    { header: "类型", width: "110px", cell: (it) => it.type || "—" },
    {
      header: "下级",
      width: "80px",
      cell: (it) => (
        <button
          type="button"
          className="text-sm text-link hover:underline"
          onClick={() => {
            setAppliedKeyword("");
            setKeyword("");
            setCrumbs((prev) => [...prev, { code: it.code, name: it.name }]);
          }}
        >
          {it.child_count > 0 ? `${it.child_count} 个` : "进入"}
        </button>
      ),
    },
    {
      header: "操作",
      width: "140px",
      cell: (it) => (
        <RowActions canWrite={canWrite} onEdit={() => openEdit(it)} onDelete={() => setDeleteTarget(it)} />
      ),
    },
  ];

  return (
    <div>
      <p className="mb-4 text-sm text-ink-soft">
        采用 12 位国家统计局区划代码。学生身份证前 6 位对应本表「身份证前6位」，用于解析户籍地（省 / 市 / 区县）。直辖市、省直管县可直接挂在省级之下。
      </p>

      <div
        className="mb-4 flex flex-col gap-3 p-4"
        style={{
          backgroundColor: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <Label htmlFor="region-lookup">按身份证试解析</Label>
            <Input
              id="region-lookup"
              value={lookupQ}
              onChange={(e) => setLookupQ(e.target.value)}
              placeholder="18 位身份证或 6 位区划码，如 110101200601010014"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleLookup();
              }}
            />
          </div>
          <Button size="sm" onClick={() => void handleLookup()} disabled={looking}>
            {looking ? "解析中…" : "解析地址"}
          </Button>
        </div>
        {lookupErr && <p className="text-sm text-error">{lookupErr}</p>}
        {lookup && (
          <p className="text-sm text-ink">
            {lookup.full_name}
            <span className="ml-2 text-ink-mute">
              （命中 {lookup.matched_name} / {lookup.matched_code}）
            </span>
          </p>
        )}
      </div>

      <Toolbar>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <button
            type="button"
            className="text-sm text-link hover:underline"
            onClick={() => {
              setCrumbs([]);
              setAppliedKeyword("");
              setKeyword("");
            }}
          >
            全国
          </button>
          {crumbs.map((c, i) => (
            <React.Fragment key={c.code}>
              <ChevronRight size={14} className="text-ink-mute" />
              <button
                type="button"
                className="text-sm text-link hover:underline"
                onClick={() => {
                  setCrumbs((prev) => prev.slice(0, i + 1));
                  setAppliedKeyword("");
                  setKeyword("");
                }}
              >
                {c.name}
              </button>
            </React.Fragment>
          ))}
          <div className="ml-3 flex min-w-40 items-center gap-2">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索名称 / 代码"
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter") setAppliedKeyword(keyword.trim());
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAppliedKeyword(keyword.trim())}
            >
              <Search size={16} />
              查询
            </Button>
          </div>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportFile(f);
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
              <Upload size={16} />
              导入 JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} disabled={importing}>
              导入内置区划
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus size={16} />
              新增
            </Button>
          </div>
        )}
      </Toolbar>

      <DataTable
        columns={columns}
        data={list}
        rowKey={(it) => it.code}
        loading={loading}
        error={error}
        onRetry={load}
        emptyLabel={appliedKeyword ? "无匹配区划" : "暂无区划，可「导入内置区划」或手动新增"}
      />

      <Modal
        open={formOpen}
        title={editing ? "编辑行政区划" : "新增行政区划"}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button size="sm" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? "保存中…" : "保存"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {parent && !editing && (
            <div className="text-sm text-ink-soft">上级：{parent.name}（{parent.code}）</div>
          )}
          <div>
            <Label htmlFor="region-code">区划代码 *</Label>
            <Input
              id="region-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6 位或 12 位数字，如 520100 或 520100000000"
              disabled={editing !== null}
            />
          </div>
          <div>
            <Label htmlFor="region-name">名称 *</Label>
            <Input id="region-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：贵阳市" />
          </div>
          <div>
            <Label htmlFor="region-level">级别 *</Label>
            <Select id="region-level" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="1">1 省级（省 / 直辖市 / 自治区 / 特别行政区）</option>
              <option value="2">2 地市（地级市 / 盟 / 自治州 / 地区）</option>
              <option value="3">3 区县（市辖区 / 县 / 县级市等）</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="region-type">类型</Label>
            <Input id="region-type" value={typ} onChange={(e) => setTyp(e.target.value)} placeholder="如：省、地级市、市辖区" />
          </div>
          <div>
            <Label htmlFor="region-sort">排序</Label>
            <Input id="region-sort" type="number" value={sort} onChange={(e) => setSort(e.target.value)} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除行政区划"
        description={`确定删除「${deleteTarget?.name}（${deleteTarget?.code}）」吗？存在下级区划时无法删除。`}
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={importOpen}
        title="导入内置行政区划"
        description="将写入全国省 / 地市及直辖市辖区（按区划代码增量更新，不删除已有记录）。台湾省因源数据代码无效会跳过。"
        confirmText="开始导入"
        loading={importing}
        onConfirm={() => void handleImportDefault()}
        onCancel={() => setImportOpen(false)}
      />
    </div>
  );
}
