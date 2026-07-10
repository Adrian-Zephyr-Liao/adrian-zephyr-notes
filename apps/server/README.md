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
ADMIN_GITHUB_LOGINS=Adrian-Zephyr-Liao
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
GITHUB_OAUTH_CALLBACK_URL=http://localhost:3002/api/auth/github/callback
LLM_API_KEY=
LLM_PROVIDER=minimax
LLM_BASE_URL=https://api.minimaxi.com/v1
LLM_MODEL=MiniMax-M3
LLM_TIMEOUT_MS=60000
LANGGRAPH_CHECKPOINT_SCHEMA=public
LANGGRAPH_CHECKPOINT_SETUP_ON_START=false
```

Missing `LLM_API_KEY` must not prevent the server from starting. AI summaries are
generated only when the provider is configured.

## Agent Workflow Persistence

Admin Agent flows use LangGraph with PostgreSQL-backed checkpoints. The default
`public` checkpoint tables are committed as Prisma migrations and are applied by
`vp run db:deploy`.

`LANGGRAPH_CHECKPOINT_SCHEMA` must be a lowercase PostgreSQL identifier such as
`public` or `agent_checkpoint`. Invalid schema names fail fast during server
startup so a paused Agent task cannot be left without a durable checkpoint store.

Use the setup command only when you intentionally run LangGraph checkpoints in a
non-default `LANGGRAPH_CHECKPOINT_SCHEMA`, or in a disposable local database
where startup-time schema setup is acceptable:

```bash
vp run -F @adrian-zephyr-notes/server langgraph:checkpoint:setup
```

Set `LANGGRAPH_CHECKPOINT_SETUP_ON_START=true` only for disposable local
development environments where startup-time schema setup is acceptable. Keep it
`false` for shared development, staging, and production deployments so schema
changes remain migration-owned and auditable.

Agent 工作台的产品边界、LangGraph 内部运行时约束、CopilotKit 人工确认交互和新增
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

| Command                                                            | Description                                                 |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| `vp run -F @adrian-zephyr-notes/server dev`                        | Start Nest in watch mode                                    |
| `vp run -F @adrian-zephyr-notes/server build`                      | Build server output                                         |
| `vp run -F @adrian-zephyr-notes/server test`                       | Run server tests                                            |
| `vp run -F @adrian-zephyr-notes/server langgraph:checkpoint:setup` | Set up LangGraph checkpoint tables for a non-default schema |
| `vp run db:generate`                                               | Generate Prisma client                                      |
| `vp run db:migrate`                                                | Create/apply local migrations                               |
| `vp run db:deploy`                                                 | Apply committed migrations                                  |
| `vp run -F @adrian-zephyr-notes/server prisma:studio`              | Open Prisma Studio                                          |
