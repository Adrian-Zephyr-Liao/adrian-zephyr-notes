# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS builder

WORKDIR /app

ARG NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=$NPM_CONFIG_REGISTRY
ENV COREPACK_NPM_REGISTRY=$NPM_CONFIG_REGISTRY

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/website/package.json apps/website/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/markdown/package.json packages/markdown/package.json

RUN --mount=type=cache,id=azn-pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store && \
  pnpm config set registry "$NPM_CONFIG_REGISTRY" && \
  pnpm install --frozen-lockfile

COPY . .

ARG VITE_BACKEND_API_BASE_URL
ENV VITE_BACKEND_API_BASE_URL=$VITE_BACKEND_API_BASE_URL

RUN pnpm --filter @adrian-zephyr-notes/admin build

FROM nginx:1.27-alpine AS runner

COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html

EXPOSE 80
