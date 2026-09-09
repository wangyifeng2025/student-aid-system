"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { resolvePageMeta } from "@/lib/nav";
import { useAuthStore } from "@/store/auth";
import { avatarInitial, roleLabel } from "@/lib/labels";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const meta = resolvePageMeta(pathname);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <header
      className="z-30 flex min-h-14 shrink-0 items-center justify-between gap-2 px-3 md:px-6"
      style={{
        backgroundColor: "var(--color-bg-card)",
        borderBottom: "1px solid var(--color-border)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-soft hover:bg-page md:hidden"
          onClick={onMenuClick}
          aria-label="打开导航"
        >
          <Menu size={20} />
        </button>
        <h1 className="truncate text-sm font-semibold text-ink">{meta.title}</h1>
        <nav className="hidden items-center gap-1 text-xs text-ink-mute md:flex" aria-label="面包屑">
          {meta.breadcrumb.map((seg, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span>/</span>}
              <span
                className={i === meta.breadcrumb.length - 1 ? "text-ink-soft" : ""}
              >
                {seg}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <button
          className="relative flex items-center justify-center rounded-sm transition-colors hover:bg-page"
          style={{ width: 36, height: 36 }}
          aria-label="通知"
        >
          <Bell size={18} style={{ color: "var(--color-text-secondary)" }} />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            className="flex items-center gap-2 rounded-sm py-1 pr-2 pl-1 transition-colors hover:bg-page"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="用户菜单"
          >
            <div
              className="flex shrink-0 items-center justify-center text-xs font-medium"
              style={{
                width: 28,
                height: 28,
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--color-primary)",
                color: "var(--color-text-inverse)",
              }}
            >
              {avatarInitial(user?.real_name || user?.username)}
            </div>
            <span className="hidden max-w-28 truncate text-sm text-ink sm:inline">
              {user?.real_name || user?.username}
            </span>
            <ChevronDown size={14} style={{ color: "var(--color-text-muted)" }} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-1 w-48 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-[var(--shadow-elevated)]"
            >
              <div className="border-b border-line px-3 py-2">
                <p className="truncate text-sm text-ink">
                  {user?.real_name || user?.username}
                </p>
                <p className="truncate text-xs text-ink-mute">
                  {roleLabel(user?.role)}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-page"
              >
                <LogOut size={15} />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
