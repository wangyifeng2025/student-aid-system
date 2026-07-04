import type { UserBrief } from "@/types/auth";

// 本地保存的会话信息
export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: UserBrief;
}

const KEY = "sas_session";

// 返回当前存有会话的 Storage（localStorage 优先，其次 sessionStorage）。
function activeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  if (window.localStorage.getItem(KEY)) return window.localStorage;
  if (window.sessionStorage.getItem(KEY)) return window.sessionStorage;
  return null;
}

// 保存会话。remember=true 用 localStorage（跨会话保留），否则 sessionStorage（关闭标签即失效）。
export function saveSession(session: StoredSession, remember: boolean): void {
  if (typeof window === "undefined") return;
  // 避免两处同时存在导致歧义
  window.localStorage.removeItem(KEY);
  window.sessionStorage.removeItem(KEY);
  const storage = remember ? window.localStorage : window.sessionStorage;
  storage.setItem(KEY, JSON.stringify(session));
}

export function loadSession(): StoredSession | null {
  const storage = activeStorage();
  if (!storage) return null;
  try {
    return JSON.parse(storage.getItem(KEY) as string) as StoredSession;
  } catch {
    return null;
  }
}

// 刷新令牌后更新会话，保持原有的 remember 存储位置。
export function updateSession(session: StoredSession): void {
  const storage = activeStorage();
  if (!storage) return;
  storage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.sessionStorage.removeItem(KEY);
}
