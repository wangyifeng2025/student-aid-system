import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Database,
  Building2,
  BookMarked,
  CalendarRange,
  Users,
  ListTree,
  MapPinned,
  ClipboardCheck,
  FileText,
  GraduationCap,
  UserCog,
  HeartHandshake,
  Megaphone,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";

export interface NavLeaf {
  type: "leaf";
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean; // 设计稿中尚未开发的模块占位
}

export interface NavGroup {
  type: "group";
  key: string;
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
}

export type NavItem = NavLeaf | NavGroup;

/** 管理员导航。页面路由与学生/评审共用 `(admin)` 布局，仅菜单与 canAccessPath 按角色分流。
 *  认定/助学金的学生申请入口不出现在此；办事与查询统一走「资助审核」。 */
export const ADMIN_NAV: NavItem[] = [
  {
    type: "leaf",
    key: "dashboard",
    label: "工作台",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    type: "group",
    key: "base-data",
    label: "基础数据管理",
    icon: Database,
    children: [
      {
        type: "leaf",
        key: "departments",
        label: "院系管理",
        href: "/base-data/departments",
        icon: Building2,
      },
      {
        type: "leaf",
        key: "majors",
        label: "专业管理",
        href: "/base-data/majors",
        icon: BookMarked,
      },
      {
        type: "leaf",
        key: "grades",
        label: "年级管理",
        href: "/base-data/grades",
        icon: CalendarRange,
      },
      {
        type: "leaf",
        key: "classes",
        label: "班级管理",
        href: "/base-data/classes",
        icon: Users,
      },
      {
        type: "leaf",
        key: "dicts",
        label: "字典管理",
        href: "/base-data/dicts",
        icon: ListTree,
      },
      {
        type: "leaf",
        key: "region-codes",
        label: "行政区划",
        href: "/base-data/region-codes",
        icon: MapPinned,
      },
    ],
  },
  {
    type: "group",
    key: "student-data",
    label: "学生管理",
    icon: GraduationCap,
    children: [
      {
        type: "leaf",
        key: "students",
        label: "学生信息",
        href: "/students",
        icon: UserCog,
      },
      {
        type: "leaf",
        key: "special-groups",
        label: "重点人群名单",
        href: "/special-groups",
        icon: HeartHandshake,
      },
    ],
  },
  {
    type: "group",
    key: "aid-review",
    label: "资助审核",
    icon: ClipboardCheck,
    children: [
      {
        type: "leaf",
        key: "review",
        label: "困难认定审核",
        href: "/reviews",
        icon: FileText,
      },
      {
        type: "leaf",
        key: "grant-review",
        label: "助学金审核",
        href: "/grant-reviews",
        icon: Wallet,
      },
    ],
  },
  {
    type: "leaf",
    key: "publicity",
    label: "公示管理",
    href: "#",
    icon: Megaphone,
    disabled: true,
  },
  {
    type: "group",
    key: "system",
    label: "系统管理",
    icon: ShieldCheck,
    children: [
      {
        type: "leaf",
        key: "users",
        label: "用户管理",
        href: "/users",
        icon: UserCog,
      },
    ],
  },
  {
    type: "leaf",
    key: "settings",
    label: "系统设置",
    href: "#",
    icon: Settings,
    disabled: true,
  },
];

/** @deprecated 请使用 ADMIN_NAV 或 getNavForRole */
export const NAV = ADMIN_NAV;

export interface PageMeta {
  title: string;
  breadcrumb: string[];
}

// 根据路径解析页面标题与面包屑（供顶部栏使用）。
export function resolvePageMeta(pathname: string): PageMeta {
  // 困难认定子路由（填报/详情/编辑）单独处理面包屑。
  if (pathname.startsWith("/recognitions")) {
    if (pathname === "/recognitions/new") {
      return { title: "困难认定填报", breadcrumb: ["首页", "困难认定", "填报"] };
    }
    if (pathname.endsWith("/edit")) {
      return { title: "编辑认定申请", breadcrumb: ["首页", "困难认定", "编辑"] };
    }
    if (pathname !== "/recognitions") {
      return { title: "认定申请详情", breadcrumb: ["首页", "困难认定", "详情"] };
    }
    return { title: "困难认定", breadcrumb: ["首页", "困难认定"] };
  }

  if (pathname.startsWith("/reviews")) {
    if (pathname !== "/reviews" && pathname !== "/reviews/records") {
      return { title: "认定申请审核", breadcrumb: ["首页", "资助审核", "困难认定审核", "详情"] };
    }
    return { title: "困难认定审核", breadcrumb: ["首页", "资助审核", "困难认定审核"] };
  }

  if (pathname.startsWith("/grants")) {
    if (pathname === "/grants/new") {
      return { title: "助学金申请填报", breadcrumb: ["首页", "助学金申请", "填报"] };
    }
    if (pathname.endsWith("/edit")) {
      return { title: "编辑助学金申请", breadcrumb: ["首页", "助学金申请", "编辑"] };
    }
    if (pathname !== "/grants") {
      return { title: "助学金申请详情", breadcrumb: ["首页", "助学金申请", "详情"] };
    }
    return { title: "助学金申请", breadcrumb: ["首页", "助学金申请"] };
  }

  if (pathname.startsWith("/grant-reviews")) {
    if (pathname !== "/grant-reviews" && pathname !== "/grant-reviews/records") {
      return { title: "助学金审核", breadcrumb: ["首页", "资助审核", "助学金审核", "详情"] };
    }
    return { title: "助学金审核", breadcrumb: ["首页", "资助审核", "助学金审核"] };
  }

  for (const item of ADMIN_NAV) {
    if (item.type === "leaf" && item.href === pathname) {
      return { title: item.label, breadcrumb: ["首页", item.label] };
    }
    if (item.type === "group") {
      const child = item.children.find((c) => c.href === pathname);
      if (child) {
        return { title: child.label, breadcrumb: ["首页", item.label, child.label] };
      }
    }
  }
  return { title: "工作台", breadcrumb: ["首页", "工作台"] };
}

/** 侧栏高亮：精确匹配，或当前路径为其子页（如 /reviews/12）。 */
export function isNavHrefActive(pathname: string, href: string): boolean {
  if (!href || href === "#") return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
