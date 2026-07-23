# syntax=docker/dockerfile:1
ARG NODE_VERSION=22

# ---------- 构建阶段 ----------
FROM node:${NODE_VERSION}-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# 先复制依赖描述，利用 Docker 缓存层
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

# 构建 Astro SSR（不使用 AI 相关脚本，避免构建时缺少环境变量）
RUN pnpm run build:no-ai

# ---------- 运行阶段 ----------
FROM node:${NODE_VERSION}-slim AS runtime

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
ENV NODE_ENV=production

# 复制生产依赖（Astro SSR standalone 仍需要 node_modules 中的运行时包）
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
