FROM node:24-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/website/package.json apps/website/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/markdown/package.json packages/markdown/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @adrian-zephyr-notes/server prisma:generate
RUN pnpm --filter @adrian-zephyr-notes/server build

EXPOSE 3001

CMD ["node", "apps/server/dist/main.js"]
