import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  List,
  Wallet,
} from "lucide-react";
import type { Role } from "@/types/auth";
import type { NavItem } from "@/lib/nav";
import { ADMIN_NAV } from "@/lib/nav";

/** 具备待办审核能力的角色（不含 admin，admin 走全量菜单）。 */
export const REVIEWER_ROLES: Role[] = [
  "classadvisor",
  "department",
  "aidcenter",
];

export function isAdmin(role?: Role): boolean {
  return role === "admin";
}

export function isStudent(role?: Role): boolean {
  return role === "student";
}

export function isReviewer(role?: Role): boolean {
  return !!role && REVIEWER_ROLES.includes(role);
}

/** 登录后默认落地页。 */
export function getHomePath(role?: Role): string {
  if (isStudent(role)) return "/recognitions";
  if (isReviewer(role)) return "/reviews";
  return "/dashboard";
}

/** 按角色过滤侧边栏菜单。 */
export function getNavForRole(role?: Role): NavItem[] {
  if (!role) return [];
  if (isAdmin(role)) return ADMIN_NAV;
  if (isStudent(role)) {
    return [
      {
        type: "leaf",
        key: "dashboard",
        label: "工作台",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        type: "leaf",
        key: "recognition",
        label: "困难认定申请",
        href: "/recognitions",
        icon: FileText,
      },
      {
        type: "leaf",
        key: "grants",
        label: "助学金申请",
        href: "/grants",
        icon: Wallet,
      },
    ];
  }
  if (isReviewer(role)) {
    return [
      {
        type: "leaf",
        key: "dashboard",
        label: "工作台",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        type: "leaf",
        key: "review",
        label: "认定待办",
        href: "/reviews",
        icon: ClipboardCheck,
      },
      {
        type: "leaf",
        key: "grant-review",
        label: "助学金待办",
        href: "/grant-reviews",
        icon: Wallet,
      },
      {
        type: "leaf",
        key: "review-records",
        label: "认定记录",
        href: "/reviews/records",
        icon: List,
      },
      {
        type: "leaf",
        key: "grant-review-records",
        label: "助学金记录",
        href: "/grant-reviews/records",
        icon: List,
      },
    ];
  }
  return [];
}

/** 路由访问控制：未授权则不应渲染页面（由 RouteGuard 重定向）。 */
export function canAccessPath(role: Role | undefined, pathname: string): boolean {
  if (!role) return false;

  const path = pathname.split("?")[0];

  if (path === "/dashboard") return true;

  // 困难认定：学生可填报；评审/管理员只读列表与详情。
  if (path.startsWith("/recognitions")) {
    if (path === "/recognitions/new" || /\/edit$/.test(path)) {
      return isStudent(role);
    }
    return isStudent(role) || isReviewer(role) || isAdmin(role);
  }

  // 待办审核：评审角色与管理员。
  if (path.startsWith("/reviews")) {
    return isReviewer(role) || isAdmin(role);
  }

  // 助学金申请：学生填报；评审/管理员只读。
  if (path.startsWith("/grants")) {
    if (path === "/grants/new" || /\/edit$/.test(path)) {
      return isStudent(role);
    }
    return isStudent(role) || isReviewer(role) || isAdmin(role);
  }

  // 助学金审核：评审角色与管理员。
  if (path.startsWith("/grant-reviews")) {
    return isReviewer(role) || isAdmin(role);
  }

  // 基础数据、学生管理：页面入口仅管理员（API 读取已对其他角色开放）。
  if (path.startsWith("/base-data")) return isAdmin(role);
  if (path.startsWith("/students")) return isAdmin(role);
  if (path.startsWith("/special-groups")) return isAdmin(role);
  if (path.startsWith("/users")) return isAdmin(role);

  return false;
}
