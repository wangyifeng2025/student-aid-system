# 学工资助管理系统 · 前端

家庭经济困难学生认定与资助流程线上化系统的管理前端。

## 技术栈

- **Next.js 16（App Router）+ TypeScript**
- **TailwindCSS v4**（设计令牌见 `src/app/globals.css`，源自统一品牌设计系统）
- **Zustand**（鉴权等客户端状态）
- **react-hook-form + zod**（表单与校验）
- **lucide-react**（图标）

## 快速开始

1. 配置后端地址（可选，默认 `http://localhost:8080`）：

```bash
cp .env.example .env.local
# 按需修改 NEXT_PUBLIC_API_BASE_URL
```

2. 安装依赖并启动开发服务器：

```bash
npm install
npm run dev      # http://localhost:3000
```

3. 确保后端已运行（见 `../backend/README.md`），用 `make seed` 创建的默认管理员登录：`admin / admin123`。

## 目录结构

```
src/
├── app/
│   ├── layout.tsx          # 根布局（中文、字体、AuthProvider）
│   ├── page.tsx            # 入口，重定向到 /login
│   ├── login/              # 登录页
│   └── dashboard/          # 登录后占位首页（后续替换为正式工作台）
├── components/
│   ├── ui/                 # 基础 UI 组件（button、input）
│   └── auth/               # 登录表单、会话恢复 Provider
├── lib/
│   ├── api.ts              # fetch 封装：统一响应、JWT、401 自动刷新
│   ├── token-storage.ts    # 令牌本地存储（记住我 → localStorage / sessionStorage）
│   └── utils.ts            # cn 类名合并
├── store/
│   └── auth.ts             # Zustand 鉴权 store
└── types/                  # API 与业务类型定义
```

## 已实现

- **模块 1 · 登录**：账号密码登录，调用后端 `POST /api/v1/auth/login`，保存双令牌，"记住我"控制持久化范围；登录后进入占位首页，支持退出登录。
- 统一请求层：业务码处理、401 自动用 refresh_token 续期重试。

API 契约见 [`../backend/docs/API.md`](../backend/docs/API.md)。
