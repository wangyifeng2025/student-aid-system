# 学生资助系统 · 后端 API 文档

> 供前端（Next.js）对接使用。当前已实现 **模块 1：认证与权限（Auth & RBAC）**、**模块 2：组织机构与基础数据（Org & Dict）**、**模块 3：学生与重点人群数据（Student & Special Group，含 Excel 导入）**、**模块 4：困难认定申请（Recognition）**、**模块 5：四级评审与退回（Review Workflow）**，后续模块会持续追加。
>
> ⚠️ 权限策略调整：**模块 2、模块 3 的全部接口（含读取）现仅 `admin` 可访问。**

## 基础信息

- Base URL（开发）：`http://localhost:8080`
- API 前缀：`/api/v1`
- 数据格式：请求与响应均为 `application/json; charset=utf-8`
- 认证方式：`Authorization: Bearer <access_token>`（除公开端点外均需携带）

## 统一响应格式

所有接口返回如下结构：

```json
{ "code": 0, "message": "ok", "data": { } }
```

- `code = 0` 表示业务成功；非 0 为失败。
- 失败时通常无 `data`，错误原因在 `message`。

### 业务码与 HTTP 状态码对照

| code | HTTP | 含义 | 前端处理建议 |
|------|------|------|--------------|
| 0 | 200 | 成功 | 正常取 `data` |
| 40000 | 400 | 参数错误 / 业务校验失败 | 提示 `message` |
| 40100 | 401 | 未认证 / 令牌无效或过期 | 跳登录或刷新令牌 |
| 40300 | 403 | 无权限 / 账号被禁用 | 提示无权限 |
| 40400 | 404 | 资源不存在 | 提示不存在 |
| 40900 | 409 | 唯一冲突 / 存在关联数据无法删除 | 提示 `message` |
| 50000 | 500 | 服务器内部错误 | 提示稍后重试 |

> 建议前端用 **HTTP 状态码** 做拦截（如 401 自动刷新），用 **body.code** 做业务判断。

## 角色与数据范围

| 角色 `role` | 说明 | 数据范围 `data_scope` |
|------|------|------|
| `student` | 学生 | `self` 本人 |
| `classadvisor` | 班主任/辅导员 | `class` 本班 |
| `department` | 教学系经办人 | `department` 本系 |
| `aidcenter` | 资助中心 | `school` 全校 |
| `admin` | 系统管理员 | `school` 全校 |

---

## 一、健康检查

### GET /health

公开。用于探活。

**响应**
```json
{
  "code": 0,
  "message": "ok",
  "data": { "status": "ok", "app": "student-aid-system", "env": "dev", "time": "2026-06-27T20:00:00+08:00" }
}
```

---

## 二、认证（公开端点）

### POST /api/v1/auth/login

账号密码登录，返回 access + refresh 双令牌。

**请求体**
```json
{ "username": "admin", "password": "admin123" }
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 学号/工号 |
| password | string | 是 | 密码 |

**成功响应 `data`**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "expires_in": 86400,
  "user": {
    "id": 1, "username": "admin", "real_name": "系统管理员", "role": "admin"
  }
}
```

- `expires_in`：access_token 有效期（秒）。
- 失败：`401 / 40100` 用户名或密码错误；`403 / 40300` 账号已被禁用。

### POST /api/v1/auth/refresh

用 refresh_token 换新的双令牌。

**请求体**
```json
{ "refresh_token": "eyJhbGc..." }
```

**成功响应 `data`**：同 login 的 `TokenResponse`。
失败：`401 / 40100` 令牌无效或已过期。

### POST /api/v1/auth/recover-password

通过用户名 + 手机号找回密码。

**请求体**
```json
{ "username": "student001", "phone": "13800000000", "new_password": "newpass1" }
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 学号/工号 |
| phone | string | 是 | 预留手机号，需与账号一致 |
| new_password | string | 是 | 新密码，至少 6 位且含字母和数字 |

**成功响应 `data`**：`{ "message": "密码已重置，请使用新密码登录" }`
失败：`400 / 40000` 手机号与账号不匹配或密码不合规。

---

## 三、认证（需登录）

> 以下端点需在请求头携带 `Authorization: Bearer <access_token>`。

### GET /api/v1/me

获取当前用户信息、数据范围与权限列表。

**成功响应 `data`**
```json
{
  "user": { "id": 1, "username": "admin", "real_name": "系统管理员", "role": "admin" },
  "data_scope": "school",
  "permissions": ["auth:me", "auth:change_password", "admin:all", "user:manage", "auth:reset_password"]
}
```

- `permissions`：供前端控制菜单/按钮可见性。各角色权限：
  - `student`：`recognition:own`, `grant:own`
  - `classadvisor`：`review:class`, `student:view_class`
  - `department`：`review:department`, `student:view_dept`
  - `aidcenter`：`review:college`, `student:view_school`, `import:export`, `publicity:manage`
  - `admin`：`admin:all`, `user:manage`, `auth:reset_password`
  - （以上均额外含基础权限 `auth:me`, `auth:change_password`）

### GET /api/v1/dashboard

工作台概览。登录用户均可访问；统计、待办与最近记录均按角色数据范围过滤（本人 / 本班 / 本系 / 全校）。评审角色的认定申请数不含草稿。

**查询参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| year | int | 学年，缺省为当前年 |

**成功响应 `data`**

```json
{
  "year": 2026,
  "role": "classadvisor",
  "data_scope": "class",
  "scope_label": "本班级",
  "dept_name": "信息工程系",
  "class_name": "计科2301",
  "kpis": [
    { "key": "recognition_total", "label": "认定申请", "value": 12, "hint": "本班级 · 2026学年" },
    { "key": "recognition_todo", "label": "认定待审", "value": 3, "hint": "班级评审待办" },
    { "key": "recognition_approved", "label": "已通过", "value": 8, "hint": "本班级 · 2026学年" },
    { "key": "grant_todo", "label": "助学金待审", "value": 1, "hint": "班级评审待办" }
  ],
  "todos": [
    {
      "id": 18,
      "kind": "recognition",
      "student_name": "张三",
      "student_no": "2023001",
      "class_name": "计科2301",
      "status": "pending_class",
      "title": "困难认定"
    }
  ],
  "recents": []
}
```

学生角色 KPI 为：认定申请、待处理（草稿/退回）、已通过、助学金申请。

### PUT /api/v1/auth/password

修改当前用户密码。

**请求体**
```json
{ "old_password": "admin123", "new_password": "newpass1" }
```

**成功响应 `data`**：`{ "message": "密码修改成功" }`
失败：`400 / 40000` 原密码错误或新密码不合规。

### POST /api/v1/auth/admin/reset-password

管理员重置指定用户密码。**仅 `admin` 角色可用**。

**请求体**
```json
{ "user_id": 5, "new_password": "reset123" }
```

**成功响应 `data`**：`{ "message": "用户密码已重置" }`
失败：`403 / 40300` 非管理员。

---

## 四、组织机构（模块 2）

> 院系 / 专业 / 年级 / 班级。**读取**（GET）所有登录用户可用；**写入**（POST/PUT/DELETE）仅 `admin`。删除带关联保护：院系下有专业/班级、专业/年级下有班级、班级下有学生时返回 `409`。

### 院系 Department

| 方法 | 路径 | 角色 | 说明 |
|------|------|------|------|
| GET | `/api/v1/orgs/departments` | 登录用户 | 列出全部院系 |
| POST | `/api/v1/orgs/departments` | admin | 新增 |
| PUT | `/api/v1/orgs/departments/:id` | admin | 修改 |
| DELETE | `/api/v1/orgs/departments/:id` | admin | 删除 |

**请求体**（POST/PUT）
```json
{ "name": "计算机学院", "code": "CS" }
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 院系名称 |
| code | string | 否 | 院系编码（非空则全局唯一） |

**成功响应 `data`**：`{ "id": 1, "name": "计算机学院", "code": "CS" }`
失败：`409 / 40900` 编码重复或存在下属专业/班级无法删除。

### 专业 Major

| 方法 | 路径 | 角色 | 说明 |
|------|------|------|------|
| GET | `/api/v1/orgs/majors?dept_id=1` | 登录用户 | 列出专业，可按 `dept_id` 过滤 |
| POST | `/api/v1/orgs/majors` | admin | 新增 |
| PUT | `/api/v1/orgs/majors/:id` | admin | 修改 |
| DELETE | `/api/v1/orgs/majors/:id` | admin | 删除 |

**请求体**
```json
{ "dept_id": 1, "name": "软件工程", "code": "SE" }
```

- `dept_id` 必填且须为已存在院系，否则 `400 / 40000`（关联数据不存在）。

### 年级 Grade

| 方法 | 路径 | 角色 | 说明 |
|------|------|------|------|
| GET | `/api/v1/orgs/grades` | 登录用户 | 列出年级（按年份倒序） |
| POST | `/api/v1/orgs/grades` | admin | 新增 |
| PUT | `/api/v1/orgs/grades/:id` | admin | 修改 |
| DELETE | `/api/v1/orgs/grades/:id` | admin | 删除 |

**请求体**
```json
{ "name": "2024级", "year": 2024 }
```

### 班级 Class

| 方法 | 路径 | 角色 | 说明 |
|------|------|------|------|
| GET | `/api/v1/orgs/classes?dept_id=1&major_id=2&grade_id=3` | 登录用户 | 列出班级，支持过滤 |
| POST | `/api/v1/orgs/classes` | admin | 新增 |
| PUT | `/api/v1/orgs/classes/:id` | admin | 修改 |
| DELETE | `/api/v1/orgs/classes/:id` | admin | 删除 |

**请求体**
```json
{ "dept_id": 1, "major_id": 2, "grade_id": 3, "name": "软工2401班", "advisor_id": 5 }
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| dept_id | uint | 是 | 所属院系（须存在） |
| major_id | uint | 否 | 所属专业（>0 时须存在） |
| grade_id | uint | 否 | 所属年级（>0 时须存在） |
| name | string | 是 | 班级名称 |
| advisor_id | uint | 否 | 班主任/辅导员的用户 ID（须存在） |

---

## 五、数据字典（模块 2）

> 前端各类下拉的统一来源。用 `type + code` 作为自然键：`code` 跨前后端交互、`label` 用于展示。**读取**（GET）所有登录用户可用；**写入**（POST/PUT/DELETE）仅 `admin`。`make seed` 会写入下列默认类型的常用项。

预置字典类型：`household_type` 户口类型、`difficulty_level` 困难等级、`health_status` 健康状况、`occupation` 职业、`relation` 与学生关系、`income_source` 收入来源、`political_status` 政治面貌、`nation` 民族、`special_group_type` 特殊群体类型。

### GET /api/v1/dicts

列出所有字典类型。**成功响应 `data`**：`["difficulty_level", "health_status", "nation", ...]`

### GET /api/v1/dicts/:type

按类型列出字典项（按 `sort`、`id` 排序）。

**成功响应 `data`**
```json
[
  { "id": 1, "type": "difficulty_level", "code": "special", "label": "特别困难", "sort": 0 },
  { "id": 2, "type": "difficulty_level", "code": "hard", "label": "比较困难", "sort": 1 },
  { "id": 3, "type": "difficulty_level", "code": "general", "label": "一般困难", "sort": 2 }
]
```

### POST /api/v1/dicts/:type

在指定类型下新增字典项。**仅 `admin`**。

**请求体**
```json
{ "code": "han", "label": "汉族", "sort": 0 }
```

失败：`409 / 40900` 该 `type+code` 已存在。

### PUT /api/v1/dicts/:type/:code

修改字典项的显示文案与排序（`type+code` 为标识，不可改）。**仅 `admin`**。

**请求体**
```json
{ "label": "汉族", "sort": 1 }
```

失败：`404 / 40400` 字典项不存在。

### DELETE /api/v1/dicts/:type/:code

删除字典项。**仅 `admin`**。失败：`404 / 40400` 不存在。

---

## 五（附）、行政区划代码（模块 2）

> 维护 12 位国家统计局区划代码，供后续按学生身份证前 6 位解析户籍地（省 / 市 / 区县）。**读取**所有登录用户可用；**写入**仅 `admin`。`make seed` 在表为空时导入内置全国数据。直辖市、省直管县可直接作为省级的下级（级别可从 1 直接到 3）。台湾省源数据代码非数字，导入时跳过。

身份证匹配顺序：6 位区县码 → 前 4 位+00 地市码 → 前 2 位+0000 省级码，命中最具体的一条后向上拼接全称。

### GET /api/v1/region-codes

列出区划。无 `keyword` 时按 `parent_code` 列出直接下级（缺省或空串为省级）；有 `keyword` 时按名称/代码/身份证前 6 位全局搜索。

**查询参数**：`parent_code`、`keyword`、`level`（1/2/3）

**成功响应 `data`**
```json
[
  {
    "id": 1,
    "code": "520000000000",
    "name": "贵州省",
    "level": 1,
    "type": "省",
    "parent_code": "",
    "id_prefix": "520000",
    "sort": 0,
    "child_count": 9
  }
]
```

### GET /api/v1/region-codes/lookup?q=

`q` 可为 18 位身份证或 6 位区划码。失败：`400` 参数不足；`404` 未命中。

**成功响应 `data`**
```json
{
  "id_prefix": "110101",
  "matched_code": "110101000000",
  "matched_name": "东城区",
  "matched_level": 3,
  "province": { "code": "110000000000", "name": "北京市", "type": "直辖市", "level": 1 },
  "city": null,
  "district": { "code": "110101000000", "name": "东城区", "type": "市辖区", "level": 3 },
  "full_name": "北京市东城区"
}
```

### GET /api/v1/region-codes/:code

按 6 位或 12 位代码查询单条。

### POST /api/v1/region-codes

新增。**仅 `admin`**。`code` 为 6 或 12 位数字（6 位自动补 6 个 0）。非省级须填 `parent_code`。失败：`409` 代码已存在；`400` 上级不存在或级别不合法。

```json
{ "code": "520100", "name": "贵阳市", "level": 2, "type": "地级市", "parent_code": "520000000000", "sort": 0 }
```

### PUT /api/v1/region-codes/:code

修改名称/级别/类型/上级/排序（代码不可改）。**仅 `admin`**。

### DELETE /api/v1/region-codes/:code

删除。有下级时 `409`「存在关联数据，无法删除」。

### POST /api/v1/region-codes/import

导入区划树 JSON（支持用户提供的 `{data:{children:[]}}` 包装，或节点本身）。按 `code` 增量 upsert。**仅 `admin`**。

### POST /api/v1/region-codes/import-default

导入系统内置全国区划。**仅 `admin`**。

**成功响应 `data`**：`{ "created": 484, "updated": 0, "skipped": 1 }`

---

## 六、学生与重点人群（模块 3）

> 学生信息管理 + 重点保障人群名单 + Excel 导入。**全部接口仅 `admin`**。
> 录入/导入学生时会按 `student_no` 或 `id_card` 自动匹配重点人群名单，命中则将学生 `is_key_group` 置为 `true`；名单变更（增删改/导入）会同步重算被影响学生的标记。

### 学生 Student

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/students` | 分页列出学生，支持过滤 |
| GET | `/api/v1/students/:id` | 学生详情 |
| POST | `/api/v1/students` | 新增（自动创建登录账号：用户名=学号，初始密码=Stu＋身份证后 6 位） |
| PUT | `/api/v1/students/:id` | 修改（同步更新关联账号的姓名/手机/院系/班级/用户名） |
| DELETE | `/api/v1/students/:id` | 删除（同时删除关联登录账号） |

**列表查询参数**：`page`（默认 1）、`page_size`（默认 20，上限 100）、`dept_id`、`major_id`、`class_id`、`keyword`（姓名/学号/身份证模糊）、`is_key_group`（`true`/`false`）。

**列表成功响应 `data`**（分页结构，后续学生类列表统一此格式）
```json
{ "items": [ { "id": 1, "student_no": "2024010101", "name": "张三", "is_key_group": true } ], "total": 1, "page": 1, "page_size": 20 }
```

**请求体**（POST/PUT）
```json
{
  "student_no": "2024010101",
  "name": "张三",
  "gender": "男",
  "birth": "2006-01-01",
  "nation": "han",
  "political_status": "masses",
  "id_card": "110101200001010010",
  "phone": "13800001111",
  "enroll_time": "2024-09-01",
  "dept_id": 1,
  "major_id": 2,
  "class_id": 3
}
```

| 字段 | 必填 | 说明与校验 |
|------|------|------|
| student_no | 是 | 学号，全局唯一 |
| name | 是 | 姓名 |
| gender | 是 | 仅 `男`/`女` |
| birth / enroll_time | 否 | 日期格式 `YYYY-MM-DD` |
| nation / political_status | 否 | 须为对应字典（`nation`/`political_status`）中的 `code` |
| id_card | 是 | 18 位居民身份证（含校验码），全局唯一 |
| phone | 否 | 中国大陆手机号 |
| dept_id / major_id / class_id | 是 | 须为已存在的院系/专业/班级 |

> 字段校验失败统一返回 `400 / 40000`，`message` 为具体原因。

### 重点人群 SpecialGroup

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/special-groups` | 分页列出，支持过滤 |
| GET | `/api/v1/special-groups/:id` | 详情 |
| POST | `/api/v1/special-groups` | 新增 |
| PUT | `/api/v1/special-groups/:id` | 修改 |
| DELETE | `/api/v1/special-groups/:id` | 删除 |

**列表查询参数**：`page`、`page_size`、`type`、`year`、`keyword`。

**请求体**
```json
{ "student_no": "2024010101", "id_card": "", "name": "张三", "type": "orphan", "source": "民政局", "batch": "2024秋", "year": 2024 }
```

| 字段 | 必填 | 说明 |
|------|------|------|
| student_no / id_card | 二选一必填 | 至少一个，用于与学生匹配 |
| type | 是 | 须为合法特殊群体类型 code（见 `special_group_type` 字典） |
| id_card | 否 | 若填写须为 18 位有效身份证 |

### Excel 导入（基于 excelize）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/import/template/:type` | 下载导入模板，返回 `.xlsx` 文件 |
| POST | `/api/v1/import/students` | 上传 Excel 导入录取/新生名单（按学号增量 upsert） |
| POST | `/api/v1/import/special-groups` | 上传 Excel 导入重点人群名单（同身份+类型+年度幂等跳过） |
| POST | `/api/v1/import/departments` | 上传 Excel 导入院系（按编码 upsert） |
| POST | `/api/v1/import/majors` | 上传 Excel 导入专业（按院系编码 + 专业编码/名称 upsert） |
| POST | `/api/v1/import/grades` | 上传 Excel 导入年级（按入学年份 upsert） |
| POST | `/api/v1/import/classes` | 上传 Excel 导入班级（按院系编码 + 班级名称 upsert） |
| GET | `/api/v1/export/students` | 导出学生信息（查询参数同列表：`dept_id`、`major_id`、`class_id`、`keyword`、`is_key_group`；不分页） |
| GET | `/api/v1/export/:type` | 导出组织机构 Excel（`type` = `departments` / `majors` / `grades` / `classes`） |

**`type` 取值**

| type | 模板/导出列 |
|------|------------|
| `students` | 学号、姓名、性别、身份证号、手机号、民族、政治面貌、院系、专业、班级、出生年月、入学时间（民族/政治面貌/院系/专业/班级均填写中文名称，由后端在名称与编码/ID 间双向转换） |
| `special-groups` | 学号、身份证号、姓名、类型(编码)、来源、批次、年度 |
| `departments` | 院系名称、院系编码 |
| `majors` | 院系编码、专业名称、专业编码 |
| `grades` | 年级名称、入学年份 |
| `classes` | 院系编码、专业编码、入学年份、班级名称、班主任用户名 |

- 上传方式：`multipart/form-data`，文件字段名 `file`。
- 组织机构导入使用**编码/名称**关联（无需记 ID），便于与导出文件往返编辑；建议按 **院系 → 专业 → 年级 → 班级** 顺序导入。
- **表头校验**：首行须与模板完全一致，否则在第 1 行回显「表头」错误。
- **逐行校验**：必填项、格式、外键/字典/关联存在性等不合规行跳过并在响应 `errors[]` 中回显（`row` 为 Excel 行号含表头，`column` 为中文列名）。

**导入成功响应 `data`**
```json
{
  "total": 100,
  "success": 98,
  "failed": 2,
  "errors": [
    { "row": 5, "column": "身份证号", "message": "身份证号格式不正确（需为 18 位有效号码）" },
    { "row": 9, "column": "", "message": "记录已存在" }
  ]
}
```

> `row` 为 Excel 行号（含表头，从 1 计）；能定位到列时给出中文列名，否则 `column` 为空、`message` 给出原因。

---

## 困难认定申请（模块 4）

所有登录角色均可访问，读写权限由后端按**角色 + 数据范围**控制：

- **学生**：仅能对**本人**申请进行创建 / 修改 / 删除 / 提交 / 撤回；只能读本人申请。
- **班主任**：只读本班；**教学系**：只读本系；**资助中心 / 管理员**：只读全校。
- 逐级评审的通过 / 退回属模块 5；本模块的"提交"将状态由 `draft`/`rejected` 流转为 `pending_class`。
- **删除**：仅未提交（`draft`/`rejected`）时可删除。
- **撤回**：已提交且状态为 `pending_class`、且尚无班级评审记录时可撤回，恢复为 `draft`；班级审核后不可撤回或删除。

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/recognitions` | 分页列表（按数据范围）。查询：`page`、`page_size`、`year`、`status`、`keyword`（姓名/学号）、`special_type`（申请表勾选的特殊群体 code，命中该勾选项即返回）。**评审角色自动排除 `draft`（学生未提交）** | 登录（按范围） |
| POST | `/api/v1/recognitions` | 创建认定申请（草稿） | 学生本人 |
| GET | `/api/v1/recognitions/:id` | 申请详情（含家庭成员） | 登录（按范围） |
| PUT | `/api/v1/recognitions/:id` | 修改（仅 `draft`/`rejected`；整体替换家庭成员） | 学生本人 |
| DELETE | `/api/v1/recognitions/:id` | 删除（仅 `draft`/`rejected`） | 学生本人 |
| POST | `/api/v1/recognitions/:id/submit` | 提交评审（完整校验 + 自动算人均收入 + 单亲/单薪提示） | 学生本人 |
| POST | `/api/v1/recognitions/:id/withdraw` | 撤回申请（仅 `pending_class` 且无班级评审记录，恢复为 `draft`） | 学生本人 |
| GET | `/api/v1/recognitions/:id/export` | 导出认定申请表 docx（仅 `approved`；基于 Word 模板填数，需配置 `export.recognition_template_path`） | 学生本人；班主任 / 教学系 / 资助中心 / 管理员按数据范围 |
| POST | `/api/v1/recognitions/:id/attachments` | 上传支撑材料（`multipart/form-data`，字段 `file`） | 学生本人 |
| GET | `/api/v1/recognitions/:id/attachments` | 列出支撑材料 | 登录（按范围） |
| GET | `/api/v1/attachments/:id/download` | 下载附件 | 登录（按范围） |
| DELETE | `/api/v1/attachments/:id` | 删除附件 | 学生本人 |

**创建/修改请求体**
```json
{
  "year": 2024,
  "nation": "han",
  "native_place": "贵州省贵阳市",
  "id_card": "110101200001010010",
  "family_population": 4,
  "phone": "13800001111",
  "address": "贵阳市花溪区某街道1号",
  "postal_code": "550000",
  "guardian_phone": "13900002222",
  "household_type": "rural",
  "income_source": "farming",
  "special_types": ["poverty", "low_income"],
  "natural_disaster": "无",
  "sudden_accident": "无",
  "weak_labor": "无",
  "unemployment": "无",
  "debt": "无",
  "other_info": "父亲长期患病",
  "commitment_agreed": true,
  "family_members": [
    { "name": "张父", "age": 50, "relation": "father", "work_unit": "务农",
      "occupation": "farmer", "annual_income": 12000, "health": "poor", "special_type": "" },
    { "name": "张母", "age": 48, "relation": "mother", "work_unit": "在家",
      "occupation": "none", "annual_income": 0, "health": "good", "special_type": "" },
    { "name": "张弟", "age": 15, "relation": "brother", "work_unit": "某中学",
      "occupation": "student", "annual_income": 0, "health": "good", "special_type": "" }
  ]
}
```

**字段约束（提交时完整校验，草稿仅校验已填字段格式）**

- `id_card`：18 位有效身份证；`phone`/`guardian_phone`：手机号格式。
- `household_type`：`urban` / `rural`；`nation`/`income_source`：须命中对应字典编码。
- 家庭成员 `relation`/`occupation`/`health`：分别须命中字典 `relation`/`occupation`/`health_status`；`special_type` 若填须为合法特殊群体类型。
- 提交时：家庭成员数须等于 `family_population - 1`（不含学生本人）；存在残疾成员（`health = disabled`）或未勾选任何 `special_types` 时，`other_info` 必填；`commitment_agreed` 须为 `true`。
- `per_capita_annual_income`：提交时由后端按"家庭成员年收入合计 ÷ 家庭人口"自动计算并覆盖。

**提交成功响应 `data`**
```json
{
  "application": { "id": 1, "status": "pending_class", "current_level": 1, "per_capita_annual_income": 3000, "...": "..." },
  "warnings": ["检测到单薪家庭（父母中仅一方有收入），请确认是否属实。"]
}
```

> 状态机：`draft`（草稿）→ `pending_class`（提交后待班级评审）。被退回为 `rejected`，可再次编辑提交（回到 `draft`）。`approved` 后锁定，可导出 PDF。

> 详情响应额外含 `reviews` 字段（评审流转记录数组，见模块 5）。

---

## 三级评审与退回（模块 5）

仅评审角色与管理员可访问（`classadvisor` / `department` / `aidcenter` / `admin`）。每个角色只能处理**自己级别**且在**数据范围内**的申请；每次通过/退回都会写入一条评审流转记录（审计）。

**评审级别与角色**

| 级别 | 状态 | 处理角色 |
|------|------|----------|
| 1 班级 | `pending_class` | `classadvisor`（通过时须**初定困难等级**） |
| 2 教学系 | `pending_dept` | `department` |
| 3 院级 | `pending_college` | `aidcenter`（通过即**认定通过** `approved`，学生可发起助学金申请） |

> `admin` 可处理任意级别（全校范围）。`pending_final` 为历史遗留状态，院级通过逻辑同样适用。

**端点**

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/reviews/todo` | 待办列表（按角色级别 + 数据范围）。查询：`page`、`page_size`、`year`、`status`、`keyword`、`special_type` | 评审角色 / admin |
| GET | `/api/v1/reviews/records` | 认定记录列表（不含学生未提交草稿）。`tab=todo`：本级待办或下级正在审核；`tab=done`：当前用户已评审过的申请；`tab=all`（默认）：数据范围内全部已提交申请。查询：`page`、`page_size`、`year`、`status`、`keyword`、`special_type` | 评审角色 / admin |
| GET | `/api/v1/reviews/:id` | 评审详情（含家庭成员与 `reviews` 流转记录） | 评审角色 / admin（按范围） |
| POST | `/api/v1/reviews/:id/pass` | 通过，流转到下一级；可初定/调整困难等级 | 对应级别 / admin |
| POST | `/api/v1/reviews/:id/reject` | 退回到指定级别（附退回意见） | 对应级别 / admin |
| POST | `/api/v1/reviews/:id/withdraw` | 撤回本人最近一次评审意见（须为最后一条评审记录且下级尚未审核） | 评审角色 / admin |
| POST | `/api/v1/reviews/batch` | 批量评审（快速定档 / 批量退回） | 评审角色 / admin |

### 助学金申请（模块 6）

**规则**：须先通过困难认定（`recognition` 状态为 `approved`）；数据从认定表自动预填；三级评审（班级 → 教学系 → 院级）与认定流程一致。

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/grants` | 助学金申请列表 | 学生本人 / 评审角色 / admin |
| POST | `/api/v1/grants` | 基于认定 ID 创建草稿（预填）`{ "recognition_id": 1 }` | 学生本人 |
| GET | `/api/v1/grants/:id` | 申请详情 | 按数据范围 |
| PUT | `/api/v1/grants/:id` | 修改草稿/被退回申请 | 学生本人 |
| DELETE | `/api/v1/grants/:id` | 删除草稿/被退回申请 | 学生本人 |
| POST | `/api/v1/grants/:id/submit` | 提交进入班级评审 | 学生本人 |
| GET | `/api/v1/grants/:id/export` | 导出《国家助学金申请表》docx（仅 `approved`；基于 Word 模板填数，需配置 `export.grant_template_path`） | 学生本人；班主任 / 教学系 / 资助中心 / 管理员按数据范围 |

**助学金评审**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/grant-reviews/todo` | 待办列表 |
| GET | `/api/v1/grant-reviews/records` | 认定记录式列表（`tab=todo/done/all`） |
| GET | `/api/v1/grant-reviews/:id` | 审核详情 |
| POST | `/api/v1/grant-reviews/:id/pass` | 通过 |
| POST | `/api/v1/grant-reviews/:id/reject` | 退回 |
| POST | `/api/v1/grant-reviews/:id/withdraw` | 撤回本人审核意见 |

**通过请求体** `POST /reviews/:id/pass`
```json
{ "difficulty_level": "general", "opinion": "属实，建议一般困难" }
```
- `difficulty_level`：`special`（特别困难）/ `hard`（比较困难）/ `general`（一般困难）。班级级通过**必填**；上级可省略（维持现有等级）或调整。
- `opinion`：评审意见，可选。
- 成功响应 `data` 为该申请详情（含更新后的 `status` / `current_level` / `difficulty_level` / `reviews`）。

**退回请求体** `POST /reviews/:id/reject`
```json
{ "reject_to_level": 0, "opinion": "材料不全，请补充低保证明" }
```
- `reject_to_level`：退回目标级别——`0`=学生重填（状态变 `rejected`）、`1`=班级、`2`=教学系、`3`=院级。须**低于**当前评审级别。
- `opinion`：退回意见，**必填**。

**批量请求体** `POST /reviews/batch`
```json
{ "ids": [1, 2, 3], "action": "pass", "difficulty_level": "general", "opinion": "" }
```
- `action`：`pass` / `reject`；其余字段同单条动作（退回用 `reject_to_level` + `opinion`）。
- 逐条执行，部分失败不阻断整体；响应汇总成功/失败明细：
```json
{ "total": 3, "success": 2, "failed": 1, "items": [ { "id": 1, "ok": true }, { "id": 3, "ok": false, "message": "班级评审通过时须初定困难等级" } ] }
```

**评审流转记录 `reviews[]` 字段**
```json
{ "id": 10, "level": 1, "reviewer_id": 5, "reviewer_name": "王老师",
  "action": "pass", "opinion": "属实", "difficulty_level": "general",
  "reject_to_level": 0, "created_at": "2026-06-28T21:00:00Z" }
```

> 完整状态机：`pending_class` →(pass)→ `pending_dept` →(pass)→ `pending_college` →(pass)→ `approved`；任一级 reject 到 `0` 变 `rejected`（学生改后重提），reject 到更低级别则回到对应 `pending_*`。

---

## 用户管理（模块 10）

仅管理员（`admin`）可访问。用户名（学号/工号）创建后不可修改；密码通过专用重置接口设置。

**端点**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/users` | 用户列表。查询：`page`、`page_size`、`role`、`status`（0/1）、`keyword`（用户名/姓名/手机号） |
| GET | `/api/v1/users/:id` | 用户详情 |
| POST | `/api/v1/users` | 新建用户 |
| PUT | `/api/v1/users/:id` | 修改用户（不含用户名与密码） |
| DELETE | `/api/v1/users/:id` | 删除用户（软删除） |
| POST | `/api/v1/users/:id/reset-password` | 重置该用户密码 |

**创建请求体** `POST /users`
```json
{ "username": "20230001", "password": "abc12345", "real_name": "王老师",
  "role": "classadvisor", "phone": "13800000000", "dept_id": 1, "class_id": 2, "status": 1 }
```
- `role`：`student` / `classadvisor` / `department` / `aidcenter` / `admin`。
- `dept_id` / `class_id`：审核角色的数据范围——班主任绑定 `class_id`（+`dept_id`），教学系绑定 `dept_id`；其余角色可省略或传 `null`。
- `status`：`1` 启用（默认）/ `0` 禁用。被禁用的账号无法登录。

**修改请求体** `PUT /users/:id`：同上但**不含** `username` / `password`。

**重置密码请求体** `POST /users/:id/reset-password`
```json
{ "new_password": "newpass1" }
```

**保护性约束**
- 不能删除或禁用当前登录账号，也不能修改自己的角色。
- 当系统仅剩一名管理员时，不能将其降级或禁用/删除。

---

## 附：密码规则

新密码需满足：长度 ≥ 6 位，且同时包含字母和数字。

## 附：端点总览

| 方法 | 路径 | 认证 | 角色 |
|------|------|------|------|
| GET | `/health` | 否 | - |
| POST | `/api/v1/auth/login` | 否 | - |
| POST | `/api/v1/auth/refresh` | 否 | - |
| POST | `/api/v1/auth/recover-password` | 否 | - |
| GET | `/api/v1/me` | 是 | 任意 |
| GET | `/api/v1/dashboard` | 是 | 任意（按数据范围） |
| PUT | `/api/v1/auth/password` | 是 | 任意 |
| POST | `/api/v1/auth/admin/reset-password` | 是 | admin |
| GET | `/api/v1/orgs/departments` `/majors` `/grades` `/classes` | 是 | admin |
| POST/PUT/DELETE | `/api/v1/orgs/{departments\|majors\|grades\|classes}[/:id]` | 是 | admin |
| GET | `/api/v1/dicts` | 是 | admin |
| GET | `/api/v1/dicts/:type` | 是 | admin |
| POST | `/api/v1/dicts/:type` | 是 | admin |
| PUT/DELETE | `/api/v1/dicts/:type/:code` | 是 | admin |
| GET | `/api/v1/region-codes` `/region-codes/lookup` `/region-codes/:code` | 是 | 登录用户 |
| POST | `/api/v1/region-codes` `/import` `/import-default` | 是 | admin |
| PUT/DELETE | `/api/v1/region-codes/:code` | 是 | admin |
| GET | `/api/v1/students` `/students/:id` | 是 | admin |
| POST/PUT/DELETE | `/api/v1/students[/:id]` | 是 | admin |
| GET | `/api/v1/special-groups` `/special-groups/:id` | 是 | admin |
| POST/PUT/DELETE | `/api/v1/special-groups[/:id]` | 是 | admin |
| GET | `/api/v1/import/template/:type` | 是 | admin |
| POST | `/api/v1/import/students` `/special-groups` `/departments` `/majors` `/grades` `/classes` | 是 | admin |
| GET | `/api/v1/export/students` | 是 | admin |
| GET | `/api/v1/export/:type` | 是 | admin（departments/majors/grades/classes） |
| GET | `/api/v1/recognitions` `/recognitions/:id` | 是 | 按数据范围 |
| POST/PUT/DELETE | `/api/v1/recognitions[/:id]` | 是 | 学生本人 |
| POST | `/api/v1/recognitions/:id/submit` | 是 | 学生本人 |
| GET | `/api/v1/recognitions/:id/export` | 是 | 按数据范围 |
| POST/GET | `/api/v1/recognitions/:id/attachments` | 是 | 上传仅本人/读取按范围 |
| GET | `/api/v1/attachments/:id/download` | 是 | 按数据范围 |
| DELETE | `/api/v1/attachments/:id` | 是 | 学生本人 |
| GET | `/api/v1/reviews/todo` | 是 | 评审角色 / admin |
| GET | `/api/v1/reviews/:id` | 是 | 评审角色 / admin（按范围） |
| POST | `/api/v1/reviews/:id/pass` `/reject` | 是 | 对应级别 / admin |
| POST | `/api/v1/reviews/batch` | 是 | 评审角色 / admin |
| GET | `/api/v1/users` `/users/:id` | 是 | admin |
| POST/PUT/DELETE | `/api/v1/users[/:id]` | 是 | admin |
| POST | `/api/v1/users/:id/reset-password` | 是 | admin |
