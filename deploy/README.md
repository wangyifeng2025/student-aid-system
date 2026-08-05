# 学生资助系统 · Docker 部署指南

面向**用户测试 / 演示环境**的一键部署方案：PostgreSQL + Go 后端 + Next.js 前端 + Nginx 反向代理。

浏览器只需访问**一个地址**（默认 `http://<服务器IP>:8088`），API 经 Nginx 同源转发至 `/api`。

---

## 架构

```text
浏览器
   │
   ▼
Nginx (:8088)
   ├── /          → frontend:3000  (Next.js)
   ├── /api/*     → backend:8080   (Gin API)
   └── /health    → backend:8080
        │
        ├── backend ──► postgres:5432
        └── uploads 卷（附件持久化）
```

| 组件 | 说明 |
|------|------|
| `postgres` | PostgreSQL 16，数据持久化到 Docker 卷 `pgdata` |
| `backend` | Go 服务，启动时自动迁移表结构 |
| `frontend` | Next.js standalone 生产构建 |
| `nginx` | 统一入口，支持附件上传（最大 25MB） |
| `seed` | 可选，写入演示字典与测试账号（profile: `init`） |

---

## 前置条件

- Docker Engine **24+**
- Docker Compose **v2+**（`docker compose` 命令）
- 服务器可用内存建议 **≥ 2GB**
- 开放端口：默认 **8088**（可在 `.env` 修改 `HTTP_PORT`）

---

## 快速部署（3 步）

### 1. 准备环境变量

```bash
cd deploy
cp .env.example .env
```

编辑 `.env`，**至少修改**：

- `POSTGRES_PASSWORD` — 数据库密码
- `JWT_SECRET` — JWT 签名密钥（测试也请勿使用默认值）

### 2. 构建并启动

```bash
docker compose up -d --build
```

首次启动约 3～8 分钟（取决于网络与机器性能）。可用以下命令查看状态：

```bash
docker compose ps
docker compose logs -f backend
```

### 3. 初始化演示数据（首次必做）

```bash
docker compose --profile init run --rm seed
```

该命令幂等，重复执行不会重复创建已存在账号。

---

## 访问与测试账号

- **访问地址**：`http://localhost:8088`（远程测试将 `localhost` 换为服务器 IP）
- **健康检查**：`http://localhost:8088/health`

| 用户名 | 密码 | 角色 | 用途 |
|--------|------|------|------|
| `admin` | `admin123` | 管理员 | 全量功能：基础数据、学生、用户、审核 |
| `2024010101` | `student123` | 学生 | 困难认定填报 |
| `advisor01` | `advisor123` | 班主任 | 班级待办审核 |
| `dept01` | `dept123` | 教学系 | 院系待办审核 |
| `aidcenter01` | `aid123` | 资助中心 | 校级待办审核 |

> 演示环境密码较简单，**请勿直接用于生产**。测试结束后建议销毁环境或修改全部密码。

---

## 常用运维命令

```bash
# 查看日志
docker compose logs -f
docker compose logs -f backend nginx

# 停止
docker compose down

# 停止并清除数据库（⚠️ 会删除所有业务数据）
docker compose down -v

# 仅重建某一服务
docker compose up -d --build backend

# 重新导入演示数据
docker compose --profile init run --rm seed
```

---

## 数据持久化

| 卷名 | 内容 |
|------|------|
| `pgdata` | PostgreSQL 数据 |
| `uploads` | 学生认定附件等上传文件 |

备份示例：

```bash
docker compose exec postgres pg_dump -U postgres student_aid_db > backup.sql
```

---

## 可选配置

### 修改对外端口

`.env` 中设置 `HTTP_PORT=80` 后重新 `docker compose up -d`。

### 认定表 / 助学金表导出

- **认定表**：导出 Word（`docx`），模板 `export.recognition_template_path`
- **助学金表**：导出 Word（`docx`），模板 `export.grant_template_path`（填数后直接返回，无需 LibreOffice）

### PDF 导出中文字体（可选，历史 fpdf 配置）

当前助学金导出已改用 Word 模板，**不再依赖** TTF 字体。若仍有旧接口需要 fpdf，可按以下方式挂载：

1. 将字体文件放到 `deploy/fonts/NotoSansSC-Regular.ttf`
2. 在 `docker-compose.yml` 的 `backend` 服务增加挂载：

   ```yaml
   volumes:
     - uploads:/app/uploads
     - ./fonts/NotoSansSC-Regular.ttf:/app/fonts/NotoSansSC-Regular.ttf:ro
   ```

3. `.env` 设置：

   ```env
   SAS_EXPORT_PDF_FONT_PATH=/app/fonts/NotoSansSC-Regular.ttf
   ```

4. `docker compose up -d --force-recreate backend`

### 不使用 Nginx（仅本地调试 Compose）

可直接映射端口（需自行处理跨域与 `NEXT_PUBLIC_API_BASE_URL`）：

- 后端：`8080`
- 前端：`3000`，构建时传入 `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`

生产/给用户测试推荐保留 Nginx 同源方案。

---

## 故障排查

| 现象 | 处理 |
|------|------|
| `backend` 一直 restarting | `docker compose logs backend`，多为数据库未就绪或密码不匹配 |
| 页面能开但登录失败 | 确认已执行 `seed`；检查 `JWT_SECRET` 是否中途变更（变更后需重新登录） |
| 上传附件失败 | 检查 `uploads` 卷权限；Nginx `client_max_body_size` 默认 25MB |
| 构建 frontend 失败 | 确认 Node 镜像可拉取；本机内存不足时可增加 Docker 内存上限 |

验证后端连通：

```bash
curl -s http://localhost:8088/health | jq .
```

---

## 生产环境补充建议（测试通过后）

- 使用 HTTPS（在 Nginx 前增加 TLS 终止或云负载均衡）
- 使用强随机 `JWT_SECRET`、`POSTGRES_PASSWORD`
- 限制 8088 端口访问来源（安全组 / 防火墙）
- 定期备份 `pgdata` 与 `uploads`
- 修改全部演示账号密码或禁用 seed 账号

---

## 文件清单

```text
deploy/
├── docker-compose.yml    # 编排文件
├── .env.example          # 环境变量模板
├── README.md             # 本文档
└── nginx/
    └── default.conf      # 反向代理规则

backend/
├── Dockerfile
├── docker-entrypoint.sh
└── cmd/server/main.go    # HTTP 服务入口

frontend/
├── Dockerfile
└── next.config.ts        # output: standalone
```
