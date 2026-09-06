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
| `postgres` | PostgreSQL 15（`postgres:15.18-trixie`），数据持久化到 Docker 卷 `pgdata` |
| `backend` | Go 服务，启动时自动迁移表结构 |
| `frontend` | Next.js standalone 生产构建 |
| `nginx` | 统一入口，支持附件上传（最大 25MB） |
| `seed` | 可选，Go `cmd/seed` 写入演示字典与测试账号（profile: `init`，复用 backend 镜像） |

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

seed 与 HTTP 服务打在同一镜像里（`/app/seed`），由 `docker-entrypoint.sh` 的 `seed` 子命令启动。它自己也会跑一遍 `AutoMigrate`（与 backend 启动时相同），因此即使表已存在也安全。不要把 seed 做成常驻服务：它写完数据就会退出。

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
| `backups` | 系统内生成的全量备份归档（`.zip`） |

---

## 数据备份与恢复

管理员登录后进入 **系统管理 → 数据备份**，无需登录服务器即可完成全量备份与恢复。

### 备份包含什么

一份备份是一个 `.zip`，内含：

```text
manifest.json          # 备份时间、操作人、各表行数、附件数量
data/<表名>.jsonl      # 全部业务数据表，逐行导出
uploads/<相对路径>      # 学生上传的证明材料等附件
```

备份由后端用 Go 直接读写数据库生成，**不依赖服务器上是否安装 `pg_dump`**，本地开发与容器部署行为一致。

### 日常操作

| 操作 | 说明 |
|------|------|
| 立即备份 | 生成一份归档存到服务器 `backups` 卷，可填备注 |
| 下载 | 把归档存到本机/云盘。**服务器损坏会连同备份卷一起丢失，务必定期下载异地保存** |
| 恢复 | 用服务器上的归档回滚；需输入「恢复」二字确认 |
| 上传备份并恢复 | 在新服务器上用本地归档重建整套数据 |

### 恢复的行为与保障

- 恢复是**全量覆盖**：先清空所有业务表，再按归档内容重建，备份之后新增的数据会消失。
- 整个写库过程在**单个事务**内完成，中途出错自动回滚，不会留下半套数据。
- 恢复前系统会**自动生成一份 `prerestore-*.zip`**，恢复错了可以直接对它再执行一次恢复退回去。
- 附件目录会被整体替换，原目录改名为 `uploads.replaced-<时间戳>` 保留在卷里，确认无误后可手动删除。
- 若备份中的账号与当前不同，恢复后需重新登录。

### 服务器损坏后的重建步骤

1. 在新机器上按本文档「快速部署」拉起服务（**不需要**执行 `seed`）。
2. 用管理员账号登录 → 系统管理 → 数据备份 → **上传备份并恢复**，选择此前下载的 `.zip`。
3. 恢复完成后重新登录，核对学生数、认定申请数与附件是否正常。

### 相关配置

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `SAS_BACKUP_DIR` | `/app/backups` | 归档存放目录 |
| `SAS_BACKUP_MAX_KEEP` | `20` | 保留份数，超出自动删除最旧的；`0` 不限制 |
| `SAS_BACKUP_MAX_UPLOAD_MB` | `1024` | 恢复时允许上传的归档大小上限 |

生产环境建议把备份卷换成宿主机绑定挂载，便于用 `rsync`/对象存储做异地同步：

```yaml
  backend:
    volumes:
      - uploads:/app/uploads
      - /data/sas-backups:/app/backups
```

也可以从宿主机直接取走归档：

```bash
docker compose cp backend:/app/backups ./sas-backups
```

> 如需数据库层面的物理备份作为补充，仍可使用 `docker compose exec postgres pg_dump -U postgres student_aid_db > backup.sql`。

---

## 可选配置

### 修改对外端口

`.env` 中设置 `HTTP_PORT=80` 后重新 `docker compose up -d`。

### 认定表 / 助学金表导出

- **认定表**：导出 PDF（需中文字体 `export.pdf_font_path`，镜像内已含 `assets/fonts/NotoSansSC-Regular.ttf`）
- **助学金表**：导出 Word（`docx`），模板 `export.grant_template_path`（填数后直接返回，无需 LibreOffice）

### PDF 导出中文字体

认定申请表 PDF 使用 TTF 中文字体。本地默认 `./assets/fonts/NotoSansSC-Regular.ttf`；Compose 默认 `/app/assets/fonts/NotoSansSC-Regular.ttf`。若需替换字体：

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
| `seed` 报 image not found | 先执行 `docker compose up -d --build`，再 `docker compose --profile init run --rm seed` |
| 页面能开但登录失败 | 确认已执行 `seed`；检查 `JWT_SECRET` 是否中途变更（变更后需重新登录） |
| 打开 8088 一直 502 | 等 `frontend` / `backend` 变为 healthy：`docker compose ps` |
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
- 定期在「数据备份」页生成备份并**下载到异地**（仅留在服务器上无法应对硬件损坏）
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
