# Server

The server is a NestJS API backed by PostgreSQL and Prisma. It owns persistence,
GitHub OAuth, comment and guestbook moderation, site configuration, audit logs,
and OpenAI-compatible article summary generation.

## Development

```bash
docker compose up -d postgres
vp run db:generate
vp run db:deploy
vp run dev:server
```

The server listens on `PORT` or `3001` by default.

## Environment

```bash
DATABASE_URL=postgresql://user:password@localhost:15432/adrian_zephyr_notes?schema=public
FRONTEND_ORIGIN=http://localhost:3002
ADMIN_FRONTEND_ORIGIN=http://localhost:3000
SESSION_COOKIE_DOMAIN=
ADMIN_GITHUB_LOGINS=Adrian-Zephyr-Liao
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
GITHUB_OAUTH_CALLBACK_URL=http://localhost:3002/api/auth/github/callback
LLM_API_KEY=
LLM_PROVIDER=minimax
LLM_BASE_URL=https://api.minimaxi.com/v1
LLM_MODEL=MiniMax-M3
LLM_TIMEOUT_MS=60000
LLM_CONTEXT_WINDOW=32768
LLM_MAX_TOKENS=8192
PI_AGENT_STORAGE_DIR=.data/pi
PI_AGENT_LEGACY_CHECKPOINT_SCHEMA=public
```

Missing `LLM_API_KEY` must not prevent the server from starting. AI summaries are
generated only when the provider is configured.

## Agent Workflow Persistence

Admin Agent conversations and business tasks run on pinned `pi-ai` and
`pi-durable` packages. PostgreSQL keeps business records, approvals, execution
receipts, and audit history; SQLite keeps the durable execution state in
`PI_AGENT_STORAGE_DIR`. Docker mounts the `agent-runtime-data` volume at
`/app/data/pi`. Keep that volume across deployments and back it up together with
PostgreSQL while the server is stopped.

Each store has one writer, enforced by a PostgreSQL advisory lock. Losing the
ownership connection invalidates the store and aborts its Harness. Do not run
multiple application replicas against the same runtime files without explicit
session routing and ownership transfer.

The business task runner automatically reacquires ownership and reopens failed
runtime storage, then resumes durable work. Retries back off from 100 ms to a
10-second ceiling; application shutdown cancels them. Initial migration or
missing-snapshot errors still fail startup rather than retrying unsafe state.

During an upgrade, stop the old server first. Startup reads active legacy tasks
from the existing checkpoint tables and imports their plain business snapshots.
`PI_AGENT_LEGACY_CHECKPOINT_SCHEMA` selects that historical schema, defaults to
`public`, and must be a lowercase PostgreSQL identifier. Unknown or incomplete
snapshots fail startup rather than silently restarting a task. Historical tables
and Prisma migrations remain intact; no old runtime package or table-setup
command is needed.

Agent 工作台的产品边界、pi 内部运行时约束、CopilotKit 人工确认交互和新增
业务处理清单见 [`docs/agent-workflow-architecture.md`](../../docs/agent-workflow-architecture.md)。

## Architecture

Business modules follow the same four-layer structure:

```text
domain/          entities, value objects, repository ports, domain errors
application/     use cases and orchestration
infrastructure/  Prisma repositories and external provider clients
presentation/    controllers, guards, decorators, DTOs
```

Current bounded contexts:

- `articles`: public article reads, admin article writes, taxonomies, AI summaries
- `auth`: GitHub OAuth, user sessions, admin access policy
- `comments`: public article comments and admin moderation
- `guestbook`: public guestbook messages and admin moderation
- `site-config`: public and admin site settings, announcements
- `audit`: admin operation log read/write model

`domain` code should not depend on Nest, Prisma, HTTP DTOs, or shared frontend
contracts. `packages/contracts` is for public HTTP shapes only.

## Commands

| Command                                               | Description                   |
| ----------------------------------------------------- | ----------------------------- |
| `vp run -F @adrian-zephyr-notes/server dev`           | Start Nest in watch mode      |
| `vp run -F @adrian-zephyr-notes/server build`         | Build server output           |
| `vp run -F @adrian-zephyr-notes/server test`          | Run server tests              |
| `vp run db:generate`                                  | Generate Prisma client        |
| `vp run db:migrate`                                   | Create/apply local migrations |
| `vp run db:deploy`                                    | Apply committed migrations    |
| `vp run -F @adrian-zephyr-notes/server prisma:studio` | Open Prisma Studio            |
