"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { canAccessPath, getHomePath } from "@/lib/access";

/** 按角色拦截未授权路由，并重定向到角色默认首页。 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const allowed =
    hydrated && isAuthenticated && role
      ? canAccessPath(role, pathname)
      : true;

  React.useEffect(() => {
    if (hydrated && isAuthenticated && role && !canAccessPath(role, pathname)) {
      router.replace(getHomePath(role));
    }
  }, [hydrated, isAuthenticated, role, pathname, router]);

  if (!allowed) return null;

  return <>{children}</>;
}
