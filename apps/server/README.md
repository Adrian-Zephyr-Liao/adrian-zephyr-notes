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
LLM_BASE_URL=https://api.minimax.io/v1
LLM_MODEL=MiniMax-M3
```

Missing `LLM_API_KEY` must not prevent the server from starting. AI summaries are
generated only when the provider is configured.

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
