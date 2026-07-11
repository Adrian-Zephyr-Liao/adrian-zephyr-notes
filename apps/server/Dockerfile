# syntax=docker/dockerfile:1.7

FROM node:24-alpine

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

RUN DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public \
  pnpm --filter @adrian-zephyr-notes/server prisma:generate
RUN pnpm --filter @adrian-zephyr-notes/server build

EXPOSE 3001

CMD ["node", "apps/server/dist/main.js"]
