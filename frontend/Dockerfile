# syntax=docker/dockerfile:1

FROM node:24.14.1-alpine3.23 AS deps

WORKDIR /app

# 国内构建加速：npm 镜像（见 https://registry.npmmirror.com ）
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}

COPY package.json package-lock.json ./
RUN npm ci

FROM node:24.14.1-alpine3.23 AS builder

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next 静态资源目录；仓库可能没有 public/，但 runner 阶段 COPY 需要该路径存在。
RUN mkdir -p public

# 留空时前端在浏览器侧使用当前站点 origin（配合 Nginx 反代）。
ARG NEXT_PUBLIC_API_BASE_URL=
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN npm run build

FROM node:24.14.1-alpine3.23 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER app

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
