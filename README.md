# 学生资助系统

家庭经济困难学生认定与国家助学金申请的线上化系统：学生填报、三级评审、通过后导出正式表单。单仓库管理后端、Web 管理端、手机端与 Docker 部署。

需求与进度见 [项目需求和开发计划.md](./项目需求和开发计划.md)。接口契约见 [backend/docs/API.md](./backend/docs/API.md)。

## 仓库结构

```
student-aid-system/
├── backend/                 # Go + Gin + GORM API（backend/README.md）
├── frontend/                # Next.js Web 管理端（frontend/README.md）
├── stuaidapp/               # Expo / React Native 手机端
├── deploy/                  # Docker Compose 演示部署（deploy/README.md）
├── 项目需求和开发计划.md
└── README.md
```

## 已上线能力（一期主路径）

| 端 | 能力 |
| --- | --- |
| **Web** | 登录、工作台、困难认定填报/审核、助学金填报/审核、基础数据与学生管理、Excel 导入导出、认定汇总表 / Word 申请表导出 |
| **手机端** | 登录、首页待办、认定与助学金填报、进度查询、评审待办与审核、签字与表单下载 |
| **后端** | JWT + RBAC（本人/本班/本系/全校）、GORM AutoMigrate、认定与助学金三级评审、附件与 Word/Excel 导出 |

**尚未做**：公示发布、名额/预算、励志奖学金等其它资助类型、站内通知、审计日志、系统参数配置、一般困难档排序辅助、找回密码/改密页面。

## 技术栈

- **后端**：Go 1.26、Gin、GORM、PostgreSQL 15（兼容 MySQL）、golang-jwt、excelize、viper
- **Web**：Next.js 16（App Router）+ TypeScript、Tailwind CSS v4、Zustand、react-hook-form + zod、TanStack Table
- **手机端**：Expo 54、React Native、expo-router、Zustand
- **部署**：Docker Compose（PostgreSQL + backend + frontend + Nginx），附件与库数据落在 Docker 卷

## 角色

| 角色 | 默认入口 | 数据范围 |
| --- | --- | --- |
| 学生 `student` | 困难认定 | 本人 |
| 班主任 `classadvisor` | 认定审核 | 所管班级 |
| 教学系 `department` | 认定审核 | 本系 |
| 资助中心 `aidcenter` | 认定审核 | 全校 |
| 管理员 `admin` | 工作台 | 全校（含基础数据 / 用户） |

流程：**先认定、后资助**。班级 → 教学系 → 资助中心，任一级可退回。认定通过后学生可发起国家助学金申请（从认定表预填）。

## 快速开始（本地开发）

三端共用同一套后端（默认 `http://localhost:8080`）。

### 1. 后端

```bash
cd backend
# 准备 PostgreSQL，创建库后改 config/config.yaml 或 .env（前缀 SAS_）
make tidy
make run          # http://localhost:8080
make seed         # 可选：演示字典、区划、测试账号
```

健康检查：`curl http://localhost:8080/health`。详见 [backend/README.md](./backend/README.md)。

### 2. Web

```bash
cd frontend
cp .env.example .env.local   # 默认 NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
npm install
npm run dev                  # http://localhost:3000
```

详见 [frontend/README.md](./frontend/README.md)。

### 3. 手机端

```bash
cd stuaidapp
npm install
npx expo start
```

在 `stuaidapp` 中配置后端地址（与 Web 相同 API 前缀 `/api/v1`），用 Expo Go 或开发构建打开。

## Docker 部署（演示 / 用户测试）

```bash
cd deploy
cp .env.example .env         # 修改 POSTGRES_PASSWORD、JWT_SECRET
docker compose up -d --build
docker compose --profile init run --rm seed   # 仅首次需要
```

浏览器访问 `http://localhost:8088`（端口见 `.env` 的 `HTTP_PORT`）。

再次部署**不要**加 `-v`：数据在卷 `pgdata` 中，backend 启动时 `AutoMigrate` 会给已有表补列。完整说明见 [deploy/README.md](./deploy/README.md)。

## 演示账号

`make seed` 或 Docker `seed` 写入（幂等）：

| 用户名 | 密码 | 角色 |
| --- | --- | --- |
| `admin` | `admin123` | 管理员 |
| `2024010101` | `student123` | 学生（挂靠演示班级） |
| `advisor01` | `advisor123` | 班主任 |
| `dept01` | `dept123` | 教学系 |
| `aidcenter01` | `aid123` | 资助中心 |

演示密码请勿用于生产。
