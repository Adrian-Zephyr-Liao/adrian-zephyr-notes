ARG NODE_IMAGE=public.ecr.aws/docker/library/node:24-alpine

FROM ${NODE_IMAGE} AS builder

WORKDIR /app

ARG NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=$NPM_CONFIG_REGISTRY
ENV COREPACK_NPM_REGISTRY=$NPM_CONFIG_REGISTRY

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/website/package.json apps/website/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/markdown/package.json packages/markdown/package.json

RUN --mount=type=cache,id=azn-pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store && \
  pnpm config set registry "$NPM_CONFIG_REGISTRY" && \
  pnpm install --frozen-lockfile --filter @adrian-zephyr-notes/website...

COPY . .

ARG BACKEND_API_BASE_URL=http://server:3001
ENV BACKEND_API_BASE_URL=$BACKEND_API_BASE_URL
ENV ARTICLE_API_BASE_URL=$BACKEND_API_BASE_URL

RUN pnpm --filter @adrian-zephyr-notes/website build

FROM ${NODE_IMAGE} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/apps/website/public ./apps/website/public
COPY --from=builder /app/apps/website/.next/standalone ./
COPY --from=builder /app/apps/website/.next/static ./apps/website/.next/static

EXPOSE 3002

CMD ["node", "apps/website/server.js"]
