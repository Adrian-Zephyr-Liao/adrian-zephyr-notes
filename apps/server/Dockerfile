ARG NODE_IMAGE=public.ecr.aws/docker/library/node:24-alpine

FROM ${NODE_IMAGE} AS builder

WORKDIR /app

ARG NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=$NPM_CONFIG_REGISTRY
ENV COREPACK_NPM_REGISTRY=$NPM_CONFIG_REGISTRY

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN --mount=type=cache,id=azn-pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store && \
  pnpm config set registry "$NPM_CONFIG_REGISTRY" && \
  pnpm install --frozen-lockfile --filter @adrian-zephyr-notes/server...

COPY . .

RUN test ! -e .env && test ! -e apps/server/.env && test ! -e deploy/docker/prod.env

RUN DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public \
  pnpm --filter @adrian-zephyr-notes/server prisma:generate
RUN pnpm --filter @adrian-zephyr-notes/server build
# Adapt only the builder lock settings for pnpm's frozen deploy path.
# Deploy copies workspace packages; development injection stays unchanged.
RUN --mount=type=cache,id=azn-pnpm-store,target=/pnpm/store \
  sed -i '/^  injectWorkspacePackages:/d; /^settings:$/a\  injectWorkspacePackages: true' pnpm-lock.yaml && \
  pnpm --filter @adrian-zephyr-notes/server --config.inject-workspace-packages=true deploy --prod --offline /prod/server
RUN cd /prod/server && \
  DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public \
  ./node_modules/.bin/prisma generate --config prisma.config.ts

FROM ${NODE_IMAGE} AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /prod/server ./
COPY --from=builder /app/packages/contracts ./packages/contracts

RUN rm node_modules/@adrian-zephyr-notes/contracts && \
  ln -s ../../packages/contracts node_modules/@adrian-zephyr-notes/contracts && \
  test ! -e .env && test ! -d .data

EXPOSE 3001

CMD ["node", "dist/main.js"]
