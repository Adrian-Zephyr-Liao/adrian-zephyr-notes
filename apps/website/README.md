# Website

The website is a Next.js app for public article reading, comments, guestbook
messages, status pages, and interactive visual details.

It uses same-origin Next.js route handlers for browser flows that involve
cookies or CORS-sensitive authentication. Those handlers proxy to the NestJS API
server through `BACKEND_API_BASE_URL`.

## Development

```bash
vp run dev:website
```

The app runs on <http://localhost:3002> by default.

## Environment

```bash
BACKEND_API_BASE_URL=http://localhost:3001
ARTICLE_API_BASE_URL=http://localhost:3001
```

`BACKEND_API_BASE_URL` is the current source of truth for Next.js API route
handlers. `ARTICLE_API_BASE_URL` is kept for compatibility with older local
commands and should not be used for new code.

## Structure

```text
src/app/                  Next.js routes and API proxy handlers
src/components/guestbook/ guestbook product experience
src/components/markdown/  article rendering, comments, notices, AI summary
src/components/site/      home page, header, skeletons, transitions
src/components/status/    empty/error/not-found states
src/components/ui/        shared UI primitives
src/lib/                  public API clients and backend proxy helpers
```

Client-side API calls should go through `src/lib/api-client.ts` or a focused
feature client. Cookie-sensitive browser calls should prefer same-origin
`src/app/api/*` routes instead of calling the NestJS API directly.

## Commands

| Command                                        | Description               |
| ---------------------------------------------- | ------------------------- |
| `vp run -F @adrian-zephyr-notes/website dev`   | Start the dev server      |
| `vp run -F @adrian-zephyr-notes/website test`  | Run website tests         |
| `vp run -F @adrian-zephyr-notes/website build` | Build the production site |
| `vp run -F @adrian-zephyr-notes/website start` | Start a production build  |
