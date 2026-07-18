# Admin Console

The admin console is a React application built with Vite+, TanStack Router,
Tailwind CSS, and shared contracts from `@adrian-zephyr-notes/contracts`.

It manages articles, article comments, guestbook messages, site configuration,
and audit logs. Authentication is handled by the API server through GitHub OAuth.

## Development

```bash
vp run dev:admin
```

The app runs on <http://localhost:3000> by default. Local browser requests stay
on the admin origin and Vite proxies `/api` to <http://127.0.0.1:3001>.

## Environment

```bash
VITE_BACKEND_PROXY_TARGET=http://127.0.0.1:3001
```

`VITE_BACKEND_API_BASE_URL` is only used for non-localhost hosts and production
builds that intentionally call a separate API origin. When previewing through a
public tunnel, configure either the Vite proxy target or the public API origin.

## Structure

```text
src/components/ui/       reusable UI primitives
src/features/articles/   article list and editor workflows
src/features/comments/   article comment moderation
src/features/guestbook/  guestbook moderation
src/features/site-config/site settings and announcements
src/features/audit/      admin operation logs
src/lib/                 API client and shared utilities
src/routes/              TanStack Router route entries
```

Feature modules own their own screen-level state and composition. Shared code in
`src/lib` should stay framework-light and covered by Vitest when it contains
request, parsing, or state transition logic.

## Commands

| Command                                                | Description                    |
| ------------------------------------------------------ | ------------------------------ |
| `vp run -F @adrian-zephyr-notes/admin dev`             | Start the dev server           |
| `vp run -F @adrian-zephyr-notes/admin test`            | Run admin tests                |
| `vp run -F @adrian-zephyr-notes/admin build`           | Build the admin bundle         |
| `vp run -F @adrian-zephyr-notes/admin generate-routes` | Regenerate TanStack route tree |
