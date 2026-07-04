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

CMD ["node", "server.js"]
