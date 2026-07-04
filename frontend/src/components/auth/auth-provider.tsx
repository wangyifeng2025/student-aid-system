"use client";

import * as React from "react";
import { useAuthStore } from "@/store/auth";

// 客户端首屏从本地存储恢复登录会话（仅执行一次）。
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  return <>{children}</>;
}
