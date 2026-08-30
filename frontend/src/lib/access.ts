import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Wallet,
  GraduationCap,
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

/** 按角色返回侧边栏。路由本身不按角色拆分，同一套页面靠本函数与 canAccessPath 分流。 */
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
        key: "students",
        label: "学生信息",
        href: "/students",
        icon: GraduationCap,
      },
      {
        type: "leaf",
        key: "review",
        label: "困难认定审核",
        href: "/reviews",
        icon: ClipboardCheck,
      },
      {
        type: "leaf",
        key: "grant-review",
        label: "助学金审核",
        href: "/grant-reviews",
        icon: Wallet,
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

  // 基础数据与账号管理仅管理员；学生名册对评审角色只读开放。
  if (path.startsWith("/base-data")) return isAdmin(role);
  if (path.startsWith("/students")) return isAdmin(role) || isReviewer(role);
  if (path.startsWith("/special-groups")) return isAdmin(role);
  if (path.startsWith("/advisors")) return isAdmin(role);
  if (path.startsWith("/users")) return isAdmin(role);

  return false;
}
