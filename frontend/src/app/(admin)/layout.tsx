"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Toaster } from "@/components/feedback/toaster";
import { RouteGuard } from "@/components/auth/route-guard";
import { useAuthStore } from "@/store/auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // 会话恢复后若未登录则跳转登录页（effect 内只做跳转）。
  React.useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated || !isAuthenticated) return null;

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <Sidebar />
      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{ marginLeft: "var(--sidebar-width)" }}
      >
        <Topbar />
        <main className="min-w-0 flex-1 overflow-x-hidden" style={{ backgroundColor: "var(--color-bg-page)" }}>
          <div className="mx-auto w-full min-w-0 px-6 py-6" style={{ maxWidth: "var(--content-max-width)" }}>
            <RouteGuard>{children}</RouteGuard>
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
