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

ARG BACKEND_API_BASE_URL=http://server:3001
ENV BACKEND_API_BASE_URL=$BACKEND_API_BASE_URL
ENV ARTICLE_API_BASE_URL=$BACKEND_API_BASE_URL

RUN pnpm --filter @adrian-zephyr-notes/website build

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

RUN corepack enable

COPY --from=builder /app /app

EXPOSE 3002

CMD ["pnpm", "--filter", "@adrian-zephyr-notes/website", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3002"]
