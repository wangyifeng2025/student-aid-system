import { create } from "zustand";
import type { TokenResponse, UserBrief } from "@/types/auth";
import {
  clearSession,
  loadSession,
  saveSession,
} from "@/lib/token-storage";

interface AuthState {
  user: UserBrief | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  hydrated: boolean; // 是否已尝试从本地存储恢复会话（用于避免首屏误判跳转）
  // 用登录/刷新返回的令牌建立会话；remember 决定是否跨会话保留。
  setSession: (tokens: TokenResponse, remember: boolean) => void;
  // 退出登录，清空内存与本地存储。
  logout: () => void;
  // 从本地存储恢复会话（客户端首屏调用一次）。
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  hydrated: false,

  setSession: (tokens, remember) => {
    saveSession(
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        user: tokens.user,
      },
      remember,
    );
    set({
      user: tokens.user,
      accessToken: tokens.access_token,
      isAuthenticated: true,
    });
  },

  logout: () => {
    clearSession();
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  hydrate: () => {
    const session = loadSession();
    if (session) {
      set({
        user: session.user,
        accessToken: session.accessToken,
        isAuthenticated: true,
        hydrated: true,
      });
    } else {
      set({ hydrated: true });
    }
  },
}));
