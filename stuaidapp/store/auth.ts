import { create } from 'zustand';

import { clearSession, restoreSession, saveSession } from '@/lib/token-storage';
import type { TokenResponse, UserBrief } from '@/types/auth';

interface AuthState {
  user: UserBrief | null;
  isAuthenticated: boolean;
  hydrated: boolean; // 是否已尝试从本地存储恢复会话（用于避免首屏误判跳转）
  setSession: (tokens: TokenResponse) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  hydrated: false,

  setSession: async (tokens) => {
    await saveSession({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user: tokens.user,
    });
    set({ user: tokens.user, isAuthenticated: true });
  },

  logout: async () => {
    await clearSession();
    set({ user: null, isAuthenticated: false });
  },

  hydrate: async () => {
    const session = await restoreSession();
    if (session) {
      set({ user: session.user, isAuthenticated: true, hydrated: true });
    } else {
      set({ hydrated: true });
    }
  },
}));
