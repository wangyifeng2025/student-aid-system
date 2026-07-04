"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Eye } from "lucide-react";
import { grantReviewApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toolbar } from "@/components/base-data/toolbar";
import { DataTable, type Column } from "@/components/base-data/data-table";
import { Pagination } from "@/components/base-data/pagination";
import { StatTabBar } from "@/components/review/stat-tab-bar";
import { GrantStatusBadge } from "@/components/grant/grant-status-badge";
import {
  GRANT_STATUS_OPTIONS,
  grantRecordsTodoStatusOptionsForRole,
  grantTypeLabel,
} from "@/lib/grant-options";
import type { GrantListItem } from "@/types/grant";

type Tab = "all" | "todo" | "done";
const TAB_ITEMS = [
  { value: "all" as Tab, label: "全部", hint: "数据范围内全部已提交申请", accentColor: "var(--color-primary)" },
  { value: "todo" as Tab, label: "待审核", hint: "需您审核或下级正在审核", accentColor: "var(--state-info)" },
  { value: "done" as Tab, label: "已审核", hint: "您本人已审核过的申请", accentColor: "var(--state-success)" },
];

export default function GrantReviewRecordsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useAuthStore((s) => s.user?.role);
  const tab = (searchParams.get("tab") as Tab) || "all";

  const [list, setList] = React.useState<GrantListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [counts, setCounts] = React.useState<Record<Tab, number>>({ all: 0, todo: 0, done: 0 });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [loading, setLoading] = React.useState(true);
  const [keyword, setKeyword] = React.useState("");

  const statusOptions = tab === "todo" ? grantRecordsTodoStatusOptionsForRole(role) : GRANT_STATUS_OPTIONS;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await grantReviewApi.records({
        tab,
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
      });
      setList(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageSize, keyword]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    (async () => {
      const tabs: Tab[] = ["all", "todo", "done"];
      const results = await Promise.all(
        tabs.map((t) => grantReviewApi.records({ tab: t, page: 1, page_size: 1, keyword: keyword || undefined })),
      );
      setCounts({ all: results[0].total, todo: results[1].total, done: results[2].total });
    })();
  }, [keyword]);

  const setTab = (t: string) => {
    router.push(`/grant-reviews/records?tab=${t}`);
    setPage(1);
  };

  const columns: Column<GrantListItem>[] = [
    { header: "姓名", cell: (r) => r.student_name },
    { header: "学号", cell: (r) => r.student_no },
    { header: "年度", cell: (r) => r.year },
    { header: "类型", cell: (r) => grantTypeLabel(r.grant_type) },
    { header: "状态", cell: (r) => <GrantStatusBadge status={r.status} /> },
    {
      header: "操作",
      cell: (r) => (
        <Link href={`/grant-reviews/${r.id}`} className="text-xs text-link hover:underline">
          <Eye size={14} className="inline" /> 查看
        </Link>
      ),
    },
  ];

  return (
    <div>
      <Toolbar>
        <Input placeholder="姓名/学号" onChange={(e) => setKeyword(e.target.value)} className="w-40" />
        <Button variant="outline" size="sm" onClick={() => setPage(1)}><Search size={16} /> 查询</Button>
      </Toolbar>
      <StatTabBar
        items={TAB_ITEMS.map((t) => ({ ...t, count: counts[t.value] }))}
        active={tab}
        onChange={setTab}
      />
      <DataTable columns={columns} data={list} rowKey={(r) => r.id} loading={loading} emptyLabel="暂无记录" />
      <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
    </div>
  );
}
