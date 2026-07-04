# 学生资助系统

家庭经济困难学生认定与资助流程线上化系统。采用单仓库（monorepo）管理，前后端分离。

需求与开发计划见 [项目需求和开发计划.md](./项目需求和开发计划.md)。

## 仓库结构

```
student-aid-system/
├── backend/      # Go + Gin + GORM 后端服务（见 backend/README.md）
├── frontend/     # Next.js 管理前端（见 frontend/README.md）
├── 项目需求和开发计划.md
└── README.md
```

## 技术栈

- **后端**：Go + Gin、GORM + PostgreSQL、golang-jwt、excelize、viper
- **前端**：Next.js + shadcn/ui + Zustand + TailwindCSS

## 快速开始

### 后端

```bash
cd backend
make tidy
make run        # 默认 http://localhost:8080
```

详见 [backend/README.md](./backend/README.md)。

### 前端

```bash
cd frontend
npm install
npm run dev     # 默认 http://localhost:3000
```

详见 [frontend/README.md](./frontend/README.md)。

## Docker 部署（用户测试 / 演示）

使用 Docker Compose 一键启动完整环境（PostgreSQL + 后端 + 前端 + Nginx）：

```bash
cd deploy
cp .env.example .env   # 修改数据库密码与 JWT 密钥
docker compose up -d --build
docker compose --profile init run --rm seed   # 首次初始化演示账号
```

浏览器访问 `http://localhost:8088`（端口可在 `.env` 的 `HTTP_PORT` 修改）。

完整说明、测试账号与运维命令见 [deploy/README.md](./deploy/README.md)。
