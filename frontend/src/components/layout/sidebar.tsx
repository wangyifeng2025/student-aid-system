"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { getNavForRole } from "@/lib/access";
import { isNavHrefActive, type NavGroup, type NavLeaf } from "@/lib/nav";
import { useAuthStore } from "@/store/auth";
import { avatarInitial, roleLabel } from "@/lib/labels";

function LeafLink({
  item,
  active,
  onNavigate,
}: {
  item: NavLeaf;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <span
        className="flex cursor-not-allowed items-center gap-3 rounded-sm px-3 py-2 text-sm opacity-45"
        style={{ color: "var(--color-text-muted)" }}
        title="待开发"
      >
        <Icon className="h-4.5 w-4.5 shrink-0" />
        <span>{item.label}</span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors duration-150"
      style={{
        color: active ? "var(--color-text-inverse)" : "var(--color-text-muted)",
        backgroundColor: active ? "var(--color-bg-sidebar-active)" : "transparent",
      }}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

function GroupBlock({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = group.icon;
  const hasActiveChild = group.children.some((c) => isNavHrefActive(pathname, c.href));
  const [open, setOpen] = React.useState(hasActiveChild);

  // 当通过其它方式进入分组下页面时自动展开
  React.useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors duration-150"
        style={{ color: "var(--color-text-muted)" }}
      >
        <Icon className="h-4.5 w-4.5 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>
      {open && (
        <ul className="mt-0.5 flex flex-col gap-0.5 pl-3">
          {group.children.map((child) => (
            <li key={child.key}>
              <LeafLink
                item={child}
                active={isNavHrefActive(pathname, child.href)}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const navItems = getNavForRole(user?.role);

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-label="关闭导航"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col overflow-y-auto transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{
          width: "var(--sidebar-width)",
          backgroundColor: "var(--color-bg-sidebar)",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        aria-label="主导航"
      >
      <div
        className="flex shrink-0 items-center gap-2.5 px-5"
        style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <ShieldCheck
          className="h-5 w-5 shrink-0"
          style={{ color: "var(--color-text-inverse)" }}
        />
        <span
          className="truncate text-sm font-semibold tracking-tight"
          style={{ color: "var(--color-text-inverse)" }}
        >
          学工资助管理系统
        </span>
      </div>

      <nav className="flex-1 px-3 py-3" aria-label="侧边栏导航">
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) =>
            item.type === "group" ? (
              <GroupBlock
                key={item.key}
                group={item}
                pathname={pathname}
                onNavigate={onClose}
              />
            ) : (
              <li key={item.key}>
                <LeafLink
                  item={item}
                  active={isNavHrefActive(pathname, item.href)}
                  onNavigate={onClose}
                />
              </li>
            ),
          )}
        </ul>
      </nav>

      <div
        className="shrink-0 px-4 py-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex shrink-0 items-center justify-center text-xs font-medium"
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--color-primary)",
              color: "var(--color-text-inverse)",
            }}
          >
            {avatarInitial(user?.real_name || user?.username)}
          </div>
          <div className="flex min-w-0 flex-col">
            <span
              className="truncate text-sm"
              style={{ color: "var(--color-text-inverse)" }}
            >
              {user?.real_name || user?.username || "未登录"}
            </span>
            <span
              className="truncate text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              {roleLabel(user?.role)}
            </span>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
