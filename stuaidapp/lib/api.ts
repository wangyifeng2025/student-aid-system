// 后端 API 客户端，对接 backend/internal/router/router.go 下的 /api/v1/* 接口。
// 统一响应 { code, message, data }；401 时自动用 refresh_token 续期重试一次。

import type { ApiResponse, PageResult } from '@/types/api';
import type { LoginRequest, TokenResponse } from '@/types/auth';
import type {
  RecognitionDetail,
  RecognitionFormState,
  RecognitionListItem,
  ReviewActionInput,
} from '@/types/recognition';
import type { CreateGrantInput, Grant, GrantInput, GrantListItem } from '@/types/grant';
import type { StudentProfile } from '@/types/student';
import { clearSession, getSession, saveSession } from '@/lib/token-storage';
// expo-file-system v19 起新增基于 File/Directory 的 API，旧版 cacheDirectory /
// downloadAsync / EncodingType 等移至 `expo-file-system/legacy`。
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export interface Attachment {
  id: number;
  owner_type: string;
  owner_id: number;
  file_name: string;
  size: number;
  mime: string;
  uploader_id: number;
}

/** 解析 API 根地址：开发时可通过 EXPO_PUBLIC_API_BASE_URL 指定局域网内后端地址
 *（如 http://192.168.1.10:8080），真机调试无法使用 localhost。 */
function getApiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return 'http://localhost:8080';
}

const API_PREFIX = '/api/v1';

export class ApiError extends Error {
  code: number;
  status: number;

  constructor(message: string, code: number, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean; // 是否携带 access_token，默认 true
}

interface RawResult<T> {
  status: number;
  body: ApiResponse<T> | null;
}

async function rawRequest<T>(
  path: string,
  { method = 'GET', body, auth = true }: RequestOptions,
): Promise<RawResult<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const session = getSession();
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${API_PREFIX}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { status: 0, body: null };
  }

  let parsed: ApiResponse<T> | null = null;
  try {
    parsed = (await res.json()) as ApiResponse<T>;
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
}

// 尝试用 refresh_token 续期，成功则更新本地会话并返回 true。
async function tryRefresh(): Promise<boolean> {
  const session = getSession();
  if (!session?.refreshToken) return false;
  const { body } = await rawRequest<TokenResponse>('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: session.refreshToken },
    auth: false,
  });
  if (!body || body.code !== 0 || !body.data) return false;
  await saveSession({
    accessToken: body.data.access_token,
    refreshToken: body.data.refresh_token,
    user: body.data.user,
  });
  return true;
}

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let { status, body } = await rawRequest<T>(path, options);

  if (status === 401 && options.auth !== false) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      ({ status, body } = await rawRequest<T>(path, options));
    } else {
      await clearSession();
    }
  }

  if (!body) {
    const message = status === 0 ? '网络连接失败，请检查网络设置' : '服务器响应异常，请稍后重试';
    throw new ApiError(message, -1, status);
  }
  if (body.code !== 0) {
    throw new ApiError(body.message || '请求失败', body.code, status);
  }
  return body.data as T;
}

function buildParams(params: Record<string, string | number | boolean | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => {
      if (v === undefined) return false;
      if (typeof v === 'string') return v !== '';
      if (typeof v === 'number') return v > 0;
      return true;
    })
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

async function downloadAndShareFile(
  path: string,
  fallbackName: string,
  mimeType: string,
  dialogTitle: string,
): Promise<void> {
  const send = async () => {
    const headers: Record<string, string> = {};
    const session = getSession();
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    const target = `${FileSystem.cacheDirectory}${fallbackName}`;
    return FileSystem.downloadAsync(`${getApiBase()}${API_PREFIX}${path}`, target, { headers });
  };

  let result = await send();
  if (result.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      result = await send();
    } else {
      await clearSession();
    }
  }
  if (result.status !== 200) {
    throw new ApiError('下载失败，请稍后重试', -1, result.status);
  }

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new ApiError('当前设备不支持分享或保存文件', -1, 0);
  }
  await Sharing.shareAsync(result.uri, { mimeType, dialogTitle, UTI: 'org.openxmlformats.spreadsheetml.sheet' });
}

/** multipart 上传本地文件（uri 可为 file:// 或 data URL 落盘后的路径）。 */
async function apiUploadFile<T>(
  path: string,
  fileUri: string,
  fileName: string,
  mime: string,
): Promise<T> {
  const send = async (): Promise<RawResult<T>> => {
    const headers: Record<string, string> = {};
    const session = getSession();
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    const form = new FormData();
    form.append('file', {
      uri: fileUri,
      name: fileName,
      type: mime,
    } as unknown as Blob);
    let res: Response;
    try {
      res = await fetch(`${getApiBase()}${API_PREFIX}${path}`, {
        method: 'POST',
        headers,
        body: form,
      });
    } catch {
      return { status: 0, body: null };
    }
    let parsed: ApiResponse<T> | null = null;
    try {
      parsed = (await res.json()) as ApiResponse<T>;
    } catch {
      parsed = null;
    }
    return { status: res.status, body: parsed };
  };

  let { status, body } = await send();
  if (status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      ({ status, body } = await send());
    } else {
      await clearSession();
    }
  }
  if (!body) {
    const message = status === 0 ? '网络连接失败，请检查网络设置' : '服务器响应异常，请稍后重试';
    throw new ApiError(message, -1, status);
  }
  if (body.code !== 0) {
    throw new ApiError(body.message || '上传失败', body.code, status);
  }
  return body.data as T;
}

// ===== 认证 =====

export function login(payload: LoginRequest): Promise<TokenResponse> {
  return apiFetch<TokenResponse>('/auth/login', { method: 'POST', body: payload, auth: false });
}

// ===== 学生本人学籍档案 =====

export const studentApi = {
  me: () => apiFetch<StudentProfile>('/students/me'),
};

// ===== 困难认定申请（学生本人填报/续填/提交，模块 4） =====

export interface RecognitionListFilter {
  year?: number;
  status?: string;
  page?: number;
  pageSize?: number;
}

export const recognitionApi = {
  list: (filter?: RecognitionListFilter) =>
    apiFetch<PageResult<RecognitionListItem>>(
      `/recognitions${buildParams({
        year: filter?.year,
        status: filter?.status,
        page: filter?.page,
        page_size: filter?.pageSize,
      })}`,
    ),
  get: (id: number) => apiFetch<RecognitionDetail>(`/recognitions/${id}`),
  create: (body: RecognitionFormState) =>
    apiFetch<RecognitionDetail>('/recognitions', { method: 'POST', body }),
  update: (id: number, body: RecognitionFormState) =>
    apiFetch<RecognitionDetail>(`/recognitions/${id}`, { method: 'PUT', body }),
  submit: (id: number) =>
    apiFetch<{ application: RecognitionDetail; warnings: string[] }>(
      `/recognitions/${id}/submit`,
      { method: 'POST' },
    ),
  withdraw: (id: number) =>
    apiFetch<RecognitionDetail>(`/recognitions/${id}/withdraw`, { method: 'POST' }),
  remove: (id: number) =>
    apiFetch<{ message: string }>(`/recognitions/${id}`, { method: 'DELETE' }),
  listAttachments: (id: number) =>
    apiFetch<Attachment[]>(`/recognitions/${id}/attachments`),
  uploadAttachment: (id: number, fileUri: string, fileName: string, mime = 'image/png') =>
    apiUploadFile<Attachment>(`/recognitions/${id}/attachments`, fileUri, fileName, mime),
  exportSummary: (filter?: {
    year?: number;
    keyword?: string;
    deptId?: number;
    classId?: number;
  }) =>
    downloadAndShareFile(
      `/recognitions/summary-export${buildParams({
        year: filter?.year,
        keyword: filter?.keyword,
        dept_id: filter?.deptId,
        class_id: filter?.classId,
      })}`,
      `recognition_summary_${filter?.year || new Date().getFullYear()}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '导出认定结果汇总表',
    ),
};

export const attachmentApi = {
  fetchDataUrl: async (id: number): Promise<string> => {
    const session = getSession();
    const headers: Record<string, string> = {};
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    const target = `${FileSystem.cacheDirectory}att_${id}.bin`;
    const result = await FileSystem.downloadAsync(
      `${getApiBase()}${API_PREFIX}/attachments/${id}/download`,
      target,
      { headers },
    );
    if (result.status !== 200) throw new ApiError('读取附件失败', -1, result.status);
    const base64 = await FileSystem.readAsStringAsync(result.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mime = result.headers?.['Content-Type'] || result.mimeType || 'image/png';
    return `data:${mime};base64,${base64}`;
  },
  remove: (id: number) =>
    apiFetch<{ message: string }>(`/attachments/${id}`, { method: 'DELETE' }),
};

// ===== 助学金申请（学生本人基于已通过认定发起，模块 6） =====

export interface GrantListFilter {
  year?: number;
  status?: string;
  grantType?: string;
  page?: number;
  pageSize?: number;
}

export const grantApi = {
  list: (filter?: GrantListFilter) =>
    apiFetch<PageResult<GrantListItem>>(
      `/grants${buildParams({
        year: filter?.year,
        status: filter?.status,
        grant_type: filter?.grantType,
        page: filter?.page,
        page_size: filter?.pageSize,
      })}`,
    ),
  get: (id: number) => apiFetch<Grant>(`/grants/${id}`),
  create: (body: CreateGrantInput) => apiFetch<Grant>('/grants', { method: 'POST', body }),
  update: (id: number, body: GrantInput) =>
    apiFetch<Grant>(`/grants/${id}`, { method: 'PUT', body }),
  submit: (id: number) => apiFetch<Grant>(`/grants/${id}/submit`, { method: 'POST' }),
  remove: (id: number) =>
    apiFetch<{ message: string }>(`/grants/${id}`, { method: 'DELETE' }),
};

// ===== 困难认定三级评审（模块 5） =====

export interface ReviewListFilter {
  tab?: 'todo' | 'done' | 'all';
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  year?: number;
  deptId?: number;
  classId?: number;
}

export const reviewApi = {
  todo: (filter?: ReviewListFilter) =>
    apiFetch<PageResult<RecognitionListItem>>(
      `/reviews/todo${buildParams({
        page: filter?.page,
        page_size: filter?.pageSize,
        keyword: filter?.keyword,
        status: filter?.status,
        year: filter?.year,
        dept_id: filter?.deptId,
        class_id: filter?.classId,
      })}`,
    ),
  records: (filter?: ReviewListFilter) =>
    apiFetch<PageResult<RecognitionListItem>>(
      `/reviews/records${buildParams({
        tab: filter?.tab,
        page: filter?.page,
        page_size: filter?.pageSize,
        keyword: filter?.keyword,
        status: filter?.status,
        year: filter?.year,
        dept_id: filter?.deptId,
        class_id: filter?.classId,
      })}`,
    ),
  get: (id: number) => apiFetch<RecognitionDetail>(`/reviews/${id}`),
  pass: (id: number, body: ReviewActionInput = {}) =>
    apiFetch<RecognitionDetail>(`/reviews/${id}/pass`, { method: 'POST', body }),
  reject: (id: number, body: ReviewActionInput) =>
    apiFetch<RecognitionDetail>(`/reviews/${id}/reject`, { method: 'POST', body }),
  withdraw: (id: number) =>
    apiFetch<RecognitionDetail>(`/reviews/${id}/withdraw`, { method: 'POST' }),
};

// ===== 助学金三级评审（模块 6，班主任/教学系/资助中心） =====

export const grantReviewApi = {
  todo: (filter?: ReviewListFilter) =>
    apiFetch<PageResult<GrantListItem>>(
      `/grant-reviews/todo${buildParams({
        page: filter?.page,
        page_size: filter?.pageSize,
        keyword: filter?.keyword,
        status: filter?.status,
        year: filter?.year,
        dept_id: filter?.deptId,
        class_id: filter?.classId,
      })}`,
    ),
  records: (filter?: ReviewListFilter) =>
    apiFetch<PageResult<GrantListItem>>(
      `/grant-reviews/records${buildParams({
        tab: filter?.tab,
        page: filter?.page,
        page_size: filter?.pageSize,
        keyword: filter?.keyword,
        status: filter?.status,
        year: filter?.year,
        dept_id: filter?.deptId,
        class_id: filter?.classId,
      })}`,
    ),
  get: (id: number) => apiFetch<Grant>(`/grant-reviews/${id}`),
  pass: (id: number, body: ReviewActionInput = {}) =>
    apiFetch<Grant>(`/grant-reviews/${id}/pass`, { method: 'POST', body }),
  reject: (id: number, body: ReviewActionInput) =>
    apiFetch<Grant>(`/grant-reviews/${id}/reject`, { method: 'POST', body }),
  withdraw: (id: number) =>
    apiFetch<Grant>(`/grant-reviews/${id}/withdraw`, { method: 'POST' }),
};

// ===== 组织机构（审核筛选：院系 / 班级） =====

export const orgApi = {
  listDepartments: () => apiFetch<import('@/types/org').Department[]>('/orgs/departments'),
  listClasses: (deptId?: number) =>
    apiFetch<import('@/types/org').OrgClass[]>(
      `/orgs/classes${buildParams({ dept_id: deptId })}`,
    ),
};
