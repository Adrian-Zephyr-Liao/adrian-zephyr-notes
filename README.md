# Adrian Zephyr Notes

Adrian Zephyr Notes is a personal publishing system for long-form notes, comments,
guestbook messages, site configuration, and AI-assisted article summaries.

The repository is a TypeScript monorepo managed by Vite+ and pnpm. It contains a
public website, an admin console, a NestJS API server, shared HTTP contracts, and
a reusable Markdown renderer.

## Applications

| Package                          | Path                 | Purpose                                                                 | Default port |
| -------------------------------- | -------------------- | ----------------------------------------------------------------------- | ------------ |
| `@adrian-zephyr-notes/server`    | `apps/server`        | NestJS API, PostgreSQL persistence, GitHub OAuth, AI summary generation | `3001`       |
| `@adrian-zephyr-notes/website`   | `apps/website`       | Public Next.js site and same-origin API proxies                         | `3002`       |
| `@adrian-zephyr-notes/admin`     | `apps/admin`         | React admin console for content and moderation                          | `3000`       |
| `@adrian-zephyr-notes/contracts` | `packages/contracts` | Shared public HTTP request/response types                               | n/a          |
| `@adrian-zephyr-notes/markdown`  | `packages/markdown`  | Shared Markdown rendering components and styles                         | n/a          |

## Quick Start

```bash
vp install
cp .env.example .env
docker compose up -d postgres
vp run db:generate
vp run db:deploy
vp run dev:server
vp run dev:website
vp run dev:admin
```

Open:

- Website: <http://localhost:3002>
- Admin: <http://localhost:3000>
- Server: <http://localhost:3001>

Use separate terminals for the three dev servers. The website talks to the API
through Next.js API routes for cookie-sensitive browser flows, while the admin
console calls the server directly with `credentials: include`.

## Environment

Start from `.env.example`. The most important variables are:

| Variable                                                | Used by         | Description                                               |
| ------------------------------------------------------- | --------------- | --------------------------------------------------------- |
| `DATABASE_URL`                                          | server / Prisma | PostgreSQL connection string                              |
| `POSTGRES_*`                                            | docker compose  | Local PostgreSQL container settings                       |
| `FRONTEND_ORIGIN`                                       | server          | Public website origin allowed by CORS                     |
| `ADMIN_FRONTEND_ORIGIN`                                 | server          | Admin origin allowed by CORS                              |
| `ADMIN_GITHUB_LOGINS`                                   | server          | Comma-separated GitHub logins allowed into admin          |
| `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` | server          | GitHub OAuth app credentials                              |
| `GITHUB_OAUTH_CALLBACK_URL`                             | server          | Website callback URL, usually `/api/auth/github/callback` |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`            | server          | OpenAI-compatible article summary provider                |
| `BACKEND_API_BASE_URL`                                  | website         | Backend URL used by Next.js route handlers                |
| `VITE_BACKEND_API_BASE_URL`                             | admin           | Backend URL baked into the admin client build             |

Do not commit real `.env`, `.env.localhost`, or `.env.ngrok` files. They are
ignored by git; committed examples must use `*.env.example`.

## Commands

| Command              | Description                               |
| -------------------- | ----------------------------------------- |
| `vp run dev:server`  | Start the NestJS server in watch mode     |
| `vp run dev:website` | Start the public website                  |
| `vp run dev:admin`   | Start the admin console                   |
| `vp run db:generate` | Generate Prisma client                    |
| `vp run db:migrate`  | Create and apply a local Prisma migration |
| `vp run db:deploy`   | Apply committed Prisma migrations         |
| `vp check`           | Format check, lint, and type check        |
| `vp test`            | Run Vitest tests                          |
| `vp run build`       | Build all apps                            |

## Architecture

The backend follows a bounded-context structure. Business modules are organized
as:

```text
domain/          entities, value objects, repository ports, domain errors
application/     use cases and orchestration over domain ports
infrastructure/  Prisma repositories and external clients
presentation/    HTTP controllers and DTOs
```

`packages/contracts` is only for public HTTP contracts shared across apps. It
should not contain Prisma models, Nest DTO classes, domain entities, or
repository interfaces.

Frontend apps are not forced into backend DDD. The website is organized around
Next.js routes, same-origin API proxies, UI components, and client helpers. The
admin console is organized by feature modules plus shared UI primitives.

## Quality Bar

Before submitting a change:

```bash
vp check
vp test
vp run -F @adrian-zephyr-notes/server build
vp run -F @adrian-zephyr-notes/website build
vp run -F @adrian-zephyr-notes/admin build
```

For database changes, include a Prisma migration and verify:

```bash
vp run db:generate
vp run db:deploy
```
