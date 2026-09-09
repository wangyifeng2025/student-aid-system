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
  const [navOpen, setNavOpen] = React.useState(false);

  // 会话恢复后若未登录则跳转登录页（effect 内只做跳转）。
  React.useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [hydrated, isAuthenticated, router]);

  React.useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  if (!hydrated || !isAuthenticated) return null;

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:ml-(--sidebar-width)">
        <Topbar onMenuClick={() => setNavOpen(true)} />
        <main
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
          style={{ backgroundColor: "var(--color-bg-page)" }}
        >
          <div
            className="mx-auto w-full min-w-0 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:py-6"
            style={{ maxWidth: "var(--content-max-width)" }}
          >
            <RouteGuard>{children}</RouteGuard>
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
