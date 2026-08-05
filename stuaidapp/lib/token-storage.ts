// 会话持久化：AsyncStorage 落盘 + 内存缓存（供 lib/api.ts 同步读取 token）。

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserBrief } from '@/types/auth';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: UserBrief;
}

const KEY = 'sas_session';

let cache: StoredSession | null = null;

/** 同步读取内存中的当前会话，需先调用一次 restoreSession()。 */
export function getSession(): StoredSession | null {
  return cache;
}

export async function saveSession(session: StoredSession): Promise<void> {
  cache = session;
  await AsyncStorage.setItem(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  cache = null;
  await AsyncStorage.removeItem(KEY);
}

/** App 启动时调用一次，从本地存储恢复会话到内存缓存。 */
export async function restoreSession(): Promise<StoredSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    cache = null;
  }
  return cache;
}
