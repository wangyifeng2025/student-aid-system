import type { ApiResponse } from "@/types/api";
import type { LoginRequest, TokenResponse } from "@/types/auth";
import type {
  Class,
  ClassInput,
  Department,
  DepartmentInput,
  Grade,
  GradeInput,
  Major,
  MajorInput,
} from "@/types/org";
import type {
  DictCreateInput,
  DictItem,
  DictUpdateInput,
} from "@/types/dict";
import type {
  ImportResult,
  PageResult,
  SpecialGroup,
  SpecialGroupFilter,
  SpecialGroupInput,
  Student,
  StudentFilter,
  StudentInput,
} from "@/types/student";
import type {
  Attachment,
  BatchReviewInput,
  BatchReviewResult,
  Recognition,
  RecognitionFilter,
  RecognitionInput,
  RecognitionListItem,
  ReviewActionInput,
  SubmitResult,
} from "@/types/recognition";
import type {
  Grant,
  GrantFilter,
  GrantInput,
  GrantListItem,
  CreateGrantInput,
} from "@/types/grant";
import type {
  ResetPasswordInput,
  User,
  UserCreateInput,
  UserFilter,
  UserUpdateInput,
} from "@/types/user";
import { clearSession, loadSession, updateSession } from "@/lib/token-storage";

/** 请求时解析 API 根地址：Docker 同源反代留空 env 即可；本地开发默认 localhost:8080。 */
function getApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  // 生产构建且未配置 env：走 Nginx 同源反代 /api → backend
  if (
    process.env.NODE_ENV === "production" &&
    typeof window !== "undefined"
  ) {
    return window.location.origin;
  }
  return "http://localhost:8080";
}

const API_PREFIX = "/api/v1";

// 业务/网络错误统一类型，调用方可据 code/status 区分处理。
export class ApiError extends Error {
  code: number;
  status: number;

  constructor(message: string, code: number, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean; // 是否携带 access_token，默认 true
  signal?: AbortSignal;
}

interface RawResult<T> {
  status: number;
  body: ApiResponse<T> | null;
}

async function rawRequest<T>(
  path: string,
  { method = "GET", body, auth = true, signal }: RequestOptions,
): Promise<RawResult<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    const session = loadSession();
    if (session?.accessToken) {
      headers["Authorization"] = `Bearer ${session.accessToken}`;
    }
  }

  const res = await fetch(`${getApiBase()}${API_PREFIX}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

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
  const session = loadSession();
  if (!session?.refreshToken) return false;
  const { body } = await rawRequest<TokenResponse>("/auth/refresh", {
    method: "POST",
    body: { refresh_token: session.refreshToken },
    auth: false,
  });
  if (!body || body.code !== 0 || !body.data) return false;
  updateSession({
    accessToken: body.data.access_token,
    refreshToken: body.data.refresh_token,
    user: body.data.user,
  });
  return true;
}

// 核心请求：解析统一响应；按 API 文档约定用 HTTP 状态码拦截 401（自动续期重试一次），
// 用 body.code 做业务判断，非 0 抛 ApiError。
async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let { status, body } = await rawRequest<T>(path, options);

  if (status === 401 && options.auth !== false) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      ({ status, body } = await rawRequest<T>(path, options));
    } else {
      clearSession();
    }
  }

  if (!body) {
    throw new ApiError("服务器响应异常，请稍后重试", -1, status);
  }
  if (body.code !== 0) {
    throw new ApiError(body.message || "请求失败", body.code, status);
  }
  return body.data as T;
}

function buildQuery(params: Record<string, number | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v > 0)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return qs ? `?${qs}` : "";
}

// 通用查询串构建：保留有效的字符串/数字/布尔参数（空串、undefined 跳过；数字需 >0）。
function buildParams(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const qs = Object.entries(params)
    .filter(([, v]) => {
      if (v === undefined) return false;
      if (typeof v === "string") return v !== "";
      if (typeof v === "number") return v > 0;
      return true; // boolean
    })
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `?${qs}` : "";
}

// 上传文件（multipart/form-data），复用 401 自动续期逻辑，按统一响应解析。
async function apiUpload<T>(path: string, file: File): Promise<T> {
  const send = async (): Promise<RawResult<T>> => {
    const headers: Record<string, string> = {};
    const session = loadSession();
    if (session?.accessToken) {
      headers["Authorization"] = `Bearer ${session.accessToken}`;
    }
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${getApiBase()}${API_PREFIX}${path}`, {
      method: "POST",
      headers,
      body: form,
    });
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
      clearSession();
    }
  }
  if (!body) {
    throw new ApiError("服务器响应异常，请稍后重试", -1, status);
  }
  if (body.code !== 0) {
    throw new ApiError(body.message || "导入失败", body.code, status);
  }
  return body.data as T;
}

// 下载二进制文件（如 Excel 模板），自动携带令牌并触发浏览器下载。
async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const headers: Record<string, string> = {};
  const session = loadSession();
  if (session?.accessToken) {
    headers["Authorization"] = `Bearer ${session.accessToken}`;
  }
  const res = await fetch(`${getApiBase()}${API_PREFIX}${path}`, { headers });
  if (!res.ok) {
    throw new ApiError("下载失败，请稍后重试", -1, res.status);
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename=([^;]+)/);
  const filename = match ? decodeURIComponent(match[1].trim()) : fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ===== 认证相关 API =====

export function login(payload: LoginRequest): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/auth/login", {
    method: "POST",
    body: payload,
    auth: false,
  });
}

// ===== 组织机构 · 院系 =====

export const departmentApi = {
  list: () => apiFetch<Department[]>("/orgs/departments"),
  create: (body: DepartmentInput) =>
    apiFetch<Department>("/orgs/departments", { method: "POST", body }),
  update: (id: number, body: DepartmentInput) =>
    apiFetch<Department>(`/orgs/departments/${id}`, { method: "PUT", body }),
  remove: (id: number) =>
    apiFetch<{ message: string }>(`/orgs/departments/${id}`, {
      method: "DELETE",
    }),
};

// ===== 组织机构 · 专业 =====

export const majorApi = {
  list: (deptId?: number) =>
    apiFetch<Major[]>(`/orgs/majors${buildQuery({ dept_id: deptId })}`),
  create: (body: MajorInput) =>
    apiFetch<Major>("/orgs/majors", { method: "POST", body }),
  update: (id: number, body: MajorInput) =>
    apiFetch<Major>(`/orgs/majors/${id}`, { method: "PUT", body }),
  remove: (id: number) =>
    apiFetch<{ message: string }>(`/orgs/majors/${id}`, { method: "DELETE" }),
};

// ===== 组织机构 · 年级 =====

export const gradeApi = {
  list: () => apiFetch<Grade[]>("/orgs/grades"),
  create: (body: GradeInput) =>
    apiFetch<Grade>("/orgs/grades", { method: "POST", body }),
  update: (id: number, body: GradeInput) =>
    apiFetch<Grade>(`/orgs/grades/${id}`, { method: "PUT", body }),
  remove: (id: number) =>
    apiFetch<{ message: string }>(`/orgs/grades/${id}`, { method: "DELETE" }),
};

// ===== 组织机构 · 班级 =====

export const classApi = {
  list: (filter?: { deptId?: number; majorId?: number; gradeId?: number }) =>
    apiFetch<Class[]>(
      `/orgs/classes${buildQuery({
        dept_id: filter?.deptId,
        major_id: filter?.majorId,
        grade_id: filter?.gradeId,
      })}`,
    ),
  create: (body: ClassInput) =>
    apiFetch<Class>("/orgs/classes", { method: "POST", body }),
  update: (id: number, body: ClassInput) =>
    apiFetch<Class>(`/orgs/classes/${id}`, { method: "PUT", body }),
  remove: (id: number) =>
    apiFetch<{ message: string }>(`/orgs/classes/${id}`, { method: "DELETE" }),
};

// ===== 数据字典 =====

export const dictApi = {
  listTypes: () => apiFetch<string[]>("/dicts"),
  listByType: (type: string) =>
    apiFetch<DictItem[]>(`/dicts/${encodeURIComponent(type)}`),
  create: (type: string, body: DictCreateInput) =>
    apiFetch<DictItem>(`/dicts/${encodeURIComponent(type)}`, {
      method: "POST",
      body,
    }),
  update: (type: string, code: string, body: DictUpdateInput) =>
    apiFetch<DictItem>(
      `/dicts/${encodeURIComponent(type)}/${encodeURIComponent(code)}`,
      { method: "PUT", body },
    ),
  remove: (type: string, code: string) =>
    apiFetch<{ message: string }>(
      `/dicts/${encodeURIComponent(type)}/${encodeURIComponent(code)}`,
      { method: "DELETE" },
    ),
};

// ===== 学生 Student =====

export const studentApi = {
  list: (filter?: StudentFilter) =>
    apiFetch<PageResult<Student>>(
      `/students${buildParams({
        page: filter?.page,
        page_size: filter?.page_size,
        dept_id: filter?.dept_id,
        major_id: filter?.major_id,
        class_id: filter?.class_id,
        keyword: filter?.keyword,
        is_key_group: filter?.is_key_group,
      })}`,
    ),
  /** 学生本人获取关联学籍档案 */
  me: () => apiFetch<Student>("/students/me"),
  get: (id: number) => apiFetch<Student>(`/students/${id}`),
  create: (body: StudentInput) =>
    apiFetch<Student>("/students", { method: "POST", body }),
  update: (id: number, body: StudentInput) =>
    apiFetch<Student>(`/students/${id}`, { method: "PUT", body }),
  remove: (id: number) =>
    apiFetch<{ message: string }>(`/students/${id}`, { method: "DELETE" }),
};

// ===== 重点保障人群 SpecialGroup =====

export const specialGroupApi = {
  list: (filter?: SpecialGroupFilter) =>
    apiFetch<PageResult<SpecialGroup>>(
      `/special-groups${buildParams({
        page: filter?.page,
        page_size: filter?.page_size,
        type: filter?.type,
        year: filter?.year,
        keyword: filter?.keyword,
      })}`,
    ),
  get: (id: number) => apiFetch<SpecialGroup>(`/special-groups/${id}`),
  create: (body: SpecialGroupInput) =>
    apiFetch<SpecialGroup>("/special-groups", { method: "POST", body }),
  update: (id: number, body: SpecialGroupInput) =>
    apiFetch<SpecialGroup>(`/special-groups/${id}`, { method: "PUT", body }),
  remove: (id: number) =>
    apiFetch<{ message: string }>(`/special-groups/${id}`, { method: "DELETE" }),
};

// ===== Excel 导入 / 导出 =====

export type OrgSpreadsheetKind =
  | "departments"
  | "majors"
  | "grades"
  | "classes";

export type ImportKind =
  | "students"
  | "special-groups"
  | OrgSpreadsheetKind;

const orgTemplateNames: Record<OrgSpreadsheetKind, string> = {
  departments: "departments_template.xlsx",
  majors: "majors_template.xlsx",
  grades: "grades_template.xlsx",
  classes: "classes_template.xlsx",
};

const orgExportNames: Record<OrgSpreadsheetKind, string> = {
  departments: "departments_export.xlsx",
  majors: "majors_export.xlsx",
  grades: "grades_export.xlsx",
  classes: "classes_export.xlsx",
};

export const importApi = {
  downloadTemplate: (type: ImportKind) => {
    const fallback =
      type === "students"
        ? "students_template.xlsx"
        : type === "special-groups"
          ? "special_groups_template.xlsx"
          : orgTemplateNames[type as OrgSpreadsheetKind];
    return downloadFile(`/import/template/${type}`, fallback);
  },
  importStudents: (file: File) =>
    apiUpload<ImportResult>("/import/students", file),
  importSpecialGroups: (file: File) =>
    apiUpload<ImportResult>("/import/special-groups", file),
  importDepartments: (file: File) =>
    apiUpload<ImportResult>("/import/departments", file),
  importMajors: (file: File) =>
    apiUpload<ImportResult>("/import/majors", file),
  importGrades: (file: File) =>
    apiUpload<ImportResult>("/import/grades", file),
  importClasses: (file: File) =>
    apiUpload<ImportResult>("/import/classes", file),
};

export const exportApi = {
  org: (type: OrgSpreadsheetKind) =>
    downloadFile(`/export/${type}`, orgExportNames[type]),
  students: (filter?: Pick<StudentFilter, "dept_id" | "major_id" | "class_id" | "keyword" | "is_key_group">) =>
    downloadFile(
      `/export/students${buildParams({
        dept_id: filter?.dept_id,
        major_id: filter?.major_id,
        class_id: filter?.class_id,
        keyword: filter?.keyword,
        is_key_group: filter?.is_key_group,
      })}`,
      "students_export.xlsx",
    ),
};

// ===== 困难认定申请 Recognition =====

export const recognitionApi = {
  list: (filter?: RecognitionFilter) =>
    apiFetch<PageResult<RecognitionListItem>>(
      `/recognitions${buildParams({
        page: filter?.page,
        page_size: filter?.page_size,
        year: filter?.year,
        status: filter?.status,
        keyword: filter?.keyword,
      })}`,
    ),
  get: (id: number) => apiFetch<Recognition>(`/recognitions/${id}`),
  create: (body: RecognitionInput) =>
    apiFetch<Recognition>("/recognitions", { method: "POST", body }),
  update: (id: number, body: RecognitionInput) =>
    apiFetch<Recognition>(`/recognitions/${id}`, { method: "PUT", body }),
  remove: (id: number) =>
    apiFetch<{ message: string }>(`/recognitions/${id}`, { method: "DELETE" }),
  submit: (id: number) =>
    apiFetch<SubmitResult>(`/recognitions/${id}/submit`, { method: "POST" }),
  withdraw: (id: number) =>
    apiFetch<Recognition>(`/recognitions/${id}/withdraw`, { method: "POST" }),
  exportDocx: (id: number, fallbackName = `recognition_${id}.docx`) =>
    downloadFile(`/recognitions/${id}/export`, fallbackName),
  // 附件
  listAttachments: (id: number) =>
    apiFetch<Attachment[]>(`/recognitions/${id}/attachments`),
  uploadAttachment: (id: number, file: File) =>
    apiUpload<Attachment>(`/recognitions/${id}/attachments`, file),
};

// ===== 用户管理 User（模块 10，仅管理员）=====

export const userApi = {
  list: (filter?: UserFilter) =>
    apiFetch<PageResult<User>>(
      `/users${buildParams({
        page: filter?.page,
        page_size: filter?.page_size,
        role: filter?.role,
        keyword: filter?.keyword,
        status:
          filter?.status === undefined ? undefined : String(filter.status),
      })}`,
    ),
  get: (id: number) => apiFetch<User>(`/users/${id}`),
  create: (body: UserCreateInput) =>
    apiFetch<User>("/users", { method: "POST", body }),
  update: (id: number, body: UserUpdateInput) =>
    apiFetch<User>(`/users/${id}`, { method: "PUT", body }),
  remove: (id: number) =>
    apiFetch<{ message: string }>(`/users/${id}`, { method: "DELETE" }),
  resetPassword: (id: number, body: ResetPasswordInput) =>
    apiFetch<{ message: string }>(`/users/${id}/reset-password`, {
      method: "POST",
      body,
    }),
};

// ===== 三级评审与退回 Review（模块 5）=====

export const reviewApi = {
  todo: (filter?: RecognitionFilter) =>
    apiFetch<PageResult<RecognitionListItem>>(
      `/reviews/todo${buildParams({
        page: filter?.page,
        page_size: filter?.page_size,
        year: filter?.year,
        status: filter?.status,
        keyword: filter?.keyword,
        dept_id: filter?.dept_id,
        class_id: filter?.class_id,
      })}`,
    ),
  records: (filter?: RecognitionFilter) =>
    apiFetch<PageResult<RecognitionListItem>>(
      `/reviews/records${buildParams({
        tab: filter?.tab,
        page: filter?.page,
        page_size: filter?.page_size,
        year: filter?.year,
        status: filter?.status,
        keyword: filter?.keyword,
        dept_id: filter?.dept_id,
        class_id: filter?.class_id,
      })}`,
    ),
  get: (id: number) => apiFetch<Recognition>(`/reviews/${id}`),
  pass: (id: number, body: ReviewActionInput = {}) =>
    apiFetch<Recognition>(`/reviews/${id}/pass`, { method: "POST", body }),
  reject: (id: number, body: ReviewActionInput) =>
    apiFetch<Recognition>(`/reviews/${id}/reject`, { method: "POST", body }),
  withdraw: (id: number) =>
    apiFetch<Recognition>(`/reviews/${id}/withdraw`, { method: "POST" }),
  batch: (body: BatchReviewInput) =>
    apiFetch<BatchReviewResult>("/reviews/batch", { method: "POST", body }),
};

// ===== 助学金申请 Grant（模块 6）=====

export const grantApi = {
  list: (filter?: GrantFilter) =>
    apiFetch<PageResult<GrantListItem>>(
      `/grants${buildParams({
        page: filter?.page,
        page_size: filter?.page_size,
        year: filter?.year,
        status: filter?.status,
        grant_type: filter?.grant_type,
        keyword: filter?.keyword,
      })}`,
    ),
  get: (id: number) => apiFetch<Grant>(`/grants/${id}`),
  create: (body: CreateGrantInput) =>
    apiFetch<Grant>("/grants", { method: "POST", body }),
  update: (id: number, body: GrantInput) =>
    apiFetch<Grant>(`/grants/${id}`, { method: "PUT", body }),
  remove: (id: number) =>
    apiFetch<{ message: string }>(`/grants/${id}`, { method: "DELETE" }),
  submit: (id: number) =>
    apiFetch<Grant>(`/grants/${id}/submit`, { method: "POST" }),
  exportDocx: (id: number, fallbackName = `grant_${id}.docx`) =>
    downloadFile(`/grants/${id}/export`, fallbackName),
};

export const grantReviewApi = {
  todo: (filter?: GrantFilter) =>
    apiFetch<PageResult<GrantListItem>>(
      `/grant-reviews/todo${buildParams({
        page: filter?.page,
        page_size: filter?.page_size,
        year: filter?.year,
        status: filter?.status,
        keyword: filter?.keyword,
        dept_id: filter?.dept_id,
        class_id: filter?.class_id,
      })}`,
    ),
  records: (filter?: GrantFilter) =>
    apiFetch<PageResult<GrantListItem>>(
      `/grant-reviews/records${buildParams({
        tab: filter?.tab,
        page: filter?.page,
        page_size: filter?.page_size,
        year: filter?.year,
        status: filter?.status,
        keyword: filter?.keyword,
        dept_id: filter?.dept_id,
        class_id: filter?.class_id,
      })}`,
    ),
  get: (id: number) => apiFetch<Grant>(`/grant-reviews/${id}`),
  pass: (id: number, body: ReviewActionInput = {}) =>
    apiFetch<Grant>(`/grant-reviews/${id}/pass`, { method: "POST", body }),
  reject: (id: number, body: ReviewActionInput) =>
    apiFetch<Grant>(`/grant-reviews/${id}/reject`, { method: "POST", body }),
  withdraw: (id: number) =>
    apiFetch<Grant>(`/grant-reviews/${id}/withdraw`, { method: "POST" }),
};

// ===== 附件下载 / 删除 =====

export const attachmentApi = {
  download: (id: number, fileName: string) =>
    downloadFile(`/attachments/${id}/download`, fileName),
  /** 以 Blob 读取附件（用于手写签字回填预览，不触发浏览器下载）。 */
  fetchBlob: async (id: number): Promise<Blob> => {
    const headers: Record<string, string> = {};
    const session = loadSession();
    if (session?.accessToken) {
      headers.Authorization = `Bearer ${session.accessToken}`;
    }
    const res = await fetch(`${getApiBase()}${API_PREFIX}/attachments/${id}/download`, {
      headers,
    });
    if (!res.ok) {
      throw new ApiError("读取附件失败", -1, res.status);
    }
    return res.blob();
  },
  remove: (id: number) =>
    apiFetch<{ message: string }>(`/attachments/${id}`, { method: "DELETE" }),
};

export { apiFetch };
