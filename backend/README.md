# 学生资助系统 · 后端

家庭经济困难学生认定与资助流程线上化系统后端服务。需求与开发计划见 [项目需求和开发计划.md](../项目需求和开发计划.md)。

## 技术栈

- Go + Gin（HTTP）
- GORM + PostgreSQL（默认；亦兼容 MySQL）
- golang-jwt/jwt（认证）
- excelize（Excel 导入导出）
- viper（配置）/ validator（校验）/ bcrypt（密码）

> 前端管理页：Next.js + shadcn/ui + Zustand + TailwindCSS（另建目录）。

## 目录结构

```
backend/
├── cmd/server/            # 程序入口
├── config/                # 配置文件 (config.yaml)
├── internal/
│   ├── config/            # 配置加载
│   ├── database/          # 数据库连接与迁移
│   ├── model/             # GORM 数据模型与枚举
│   ├── middleware/        # JWT、RBAC、CORS 等中间件
│   ├── handler/           # HTTP 处理器（控制器）
│   ├── service/           # 业务逻辑层
│   ├── repository/        # 数据访问层
│   ├── dto/               # 请求/响应数据结构
│   └── router/            # 路由注册
├── pkg/
│   ├── jwt/               # JWT 工具
│   ├── response/          # 统一响应
│   └── validate/          # 业务校验（身份证/手机号等）
├── uploads/               # 附件存储（gitignore）
├── go.mod
├── Makefile
└── README.md
```

## 快速开始

1. 准备数据库（PostgreSQL 14+），创建数据库：

```sql
CREATE DATABASE student_aid WITH ENCODING 'UTF8';
```

2. 修改 `config/config.yaml` 或通过环境变量（前缀 `SAS_`）配置数据库与 JWT 密钥（参考 `.env.example`）。

3. 安装依赖并运行：

```bash
make tidy
make run
```

4. 验证：

```bash
curl http://localhost:8080/health
```

## 已实现（脚手架）

- 配置加载、数据库连接与自动迁移
- 全部核心数据模型
- **模块 1 认证与权限**：登录、JWT 双令牌刷新、修改密码、找回密码、管理员重置密码、RBAC 角色中间件、数据范围（本人/本班/本系/全校）
- **模块 2 组织机构与基础数据**：院系/专业/年级/班级维护（外键校验 + 删除关联保护）、数据字典 CRUD（按 `type+code` 自然键，前端下拉来源）、**行政区划代码**（12 位国标码，按身份证前 6 位解析户籍地；读取登录用户、写入仅管理员），`make seed` 写入默认字典与全国区划
- **模块 3 学生与重点人群数据**：学生信息管理（身份证/手机号/字典/外键校验 + 分页筛选）、重点保障人群名单管理、Excel 导入（模板下载 + 逐行错误回显，学生按学号增量 upsert）、重点人群自动匹配（命中标记 `is_key_group`，名单变更自动重算），**全部接口仅管理员**
- **模块 4 困难认定申请**：在线填报认定申请表（基本情况 / 家庭成员 / 影响信息 / 个人承诺）、草稿与提交、整套数据校验与逻辑提示（身份证/手机号、家庭成员数与家庭人口一致、字典下拉约束、残疾或未勾选特殊群体须填其他情况、人均收入自动计算、单亲/单薪提示）、支撑材料附件上传/列出/下载/删除（本地磁盘）、认定通过后导出 Word（基于 docx 模板填数，无需外部依赖）。权限：学生增删改/提交本人，各级按数据范围只读
- JWT 认证、CORS、统一响应
- 健康检查、`/me` 当前用户与权限列表

### 认证 API（模块 1）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/v1/auth/login` | 登录，返回 access_token + refresh_token | 否 |
| POST | `/api/v1/auth/refresh` | 刷新令牌 | 否 |
| POST | `/api/v1/auth/recover-password` | 找回密码（用户名+手机号） | 否 |
| GET | `/api/v1/me` | 当前用户、data_scope、permissions | 是 |
| PUT | `/api/v1/auth/password` | 修改密码 | 是 |
| POST | `/api/v1/auth/admin/reset-password` | 管理员重置用户密码 | 是（admin） |

### 组织机构与字典 API（模块 2，全部仅 admin）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/v1/orgs/departments` `/majors` `/grades` `/classes` | 列表（`majors`/`classes` 支持 `dept_id`/`major_id`/`grade_id` 过滤） | 是（admin） |
| POST/PUT/DELETE | `/api/v1/orgs/{departments\|majors\|grades\|classes}[/:id]` | 增删改 | 是（admin） |
| GET | `/api/v1/dicts` `/dicts/:type` | 字典类型 / 按类型列项 | 是（登录用户） |
| POST | `/api/v1/dicts/:type` | 新增字典项 | 是（admin） |
| PUT/DELETE | `/api/v1/dicts/:type/:code` | 改/删字典项 | 是（admin） |
| GET | `/api/v1/region-codes` `/lookup` `/:code` | 行政区划列表 / 身份证解析 / 详情 | 是（登录用户） |
| POST/PUT/DELETE | `/api/v1/region-codes` | 增删改、导入 JSON / 内置数据 | 是（admin） |

### 学生与重点人群 API（模块 3）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/v1/students` `/students/:id` | 学生名册（分页/筛选，含学年申报进度） | 是（班主任/系部/资助中心/admin，按数据范围） |
| POST/PUT/DELETE | `/api/v1/students[/:id]` | 学生增删改 | 是（admin） |
| GET | `/api/v1/special-groups` `/special-groups/:id` | 重点人群列表/详情 | 是（admin） |
| POST/PUT/DELETE | `/api/v1/special-groups[/:id]` | 重点人群增删改 | 是（admin） |
| GET | `/api/v1/import/template/:type` | 下载导入模板（`students`/`special-groups`） | 是（admin） |
| POST | `/api/v1/import/students` `/import/special-groups` | Excel 导入（`multipart`，字段 `file`） | 是（admin） |

完整字段与示例见 [docs/API.md](./docs/API.md)。

初始化数据：`make seed`（幂等，可重复执行）

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| `admin` | `admin123` | 管理员 | 全量菜单与数据范围 |
| `2024010101` | `student123` | 学生 | 困难认定填报；已挂靠演示班级「软工2401班」 |
| `advisor01` | `advisor123` | 班主任 | 待办审核；数据范围：软工2401班 |
| `dept01` | `dept123` | 教学系 | 待办审核；数据范围：信息工程学院 |
| `aidcenter01` | `aid123` | 资助中心 | 待办审核；数据范围：全校 |

同时写入默认字典与演示组织机构（信息工程学院 / 软件工程 / 2024级 / 软工2401班）。

## 待实现（按里程碑）

认定填报与校验、四级评审与退回、资助申请、Excel 导入导出、公示、通知、系统管理。详见开发计划。
