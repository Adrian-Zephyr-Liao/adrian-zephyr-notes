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

RUN DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public \
  pnpm --filter @adrian-zephyr-notes/server prisma:generate
RUN pnpm --filter @adrian-zephyr-notes/server build
RUN pnpm --filter @adrian-zephyr-notes/server deploy --legacy --prod /prod/server
RUN cd /prod/server && \
  DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public \
  ./node_modules/.bin/prisma generate --config prisma.config.ts

FROM ${NODE_IMAGE} AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /prod/server ./
COPY --from=builder /app/packages/contracts ./packages/contracts

RUN rm node_modules/@adrian-zephyr-notes/contracts && \
  ln -s ../../packages/contracts node_modules/@adrian-zephyr-notes/contracts

EXPOSE 3001

CMD ["node", "dist/main.js"]
