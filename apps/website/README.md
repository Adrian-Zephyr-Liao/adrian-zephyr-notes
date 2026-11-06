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
src/app/             Next.js routes, metadata, loading/error UI, and API proxies
src/components/site/ shared header, footer, page shells, and status UI
src/components/ui/   design-system primitives
src/entities/        article cards and resilient cover images
src/features/        home, archive, taxonomy, reading, comments, and guestbook
src/lib/             public API clients and backend proxy helpers
src/shared/          cross-feature date formatting
packages/markdown/   shared Markdown renderer and reading navigation
```

Client-side API calls should go through `src/lib/api-client.ts` or a focused
feature client. Cookie-sensitive browser calls should prefer same-origin
`src/app/api/*` routes instead of calling the NestJS API directly.

Production Caddy routes `/api/*` directly to the NestJS server. Verify public
authentication and content endpoints after deployment as well as the local proxy.
Read failures must remain distinguishable from empty content. A write without a
confirmed response may have committed; preserve the draft and ask the reader to
check the current content before resubmitting.

## Commands

| Command                                               | Description                        |
| ----------------------------------------------------- | ---------------------------------- |
| `vp run -F @adrian-zephyr-notes/website dev`          | Start the dev server               |
| `vp run -F @adrian-zephyr-notes/website test`         | Run website tests                  |
| `vp run -F @adrian-zephyr-notes/website test:browser` | Run desktop/mobile Chromium checks |
| `vp run -F @adrian-zephyr-notes/website build`        | Build the production site          |
| `vp run -F @adrian-zephyr-notes/website start`        | Start the standalone server        |

The production build uses Next.js standalone output. After building, run
`vp run -F @adrian-zephyr-notes/website start` from the repository root. The shared
standalone launcher prepares `public` and `.next/static` assets before starting
the same server entrypoint used by the Docker image. It defaults to
`127.0.0.1:3002`; `HOSTNAME`, `PORT`, and `BACKEND_API_BASE_URL` can override the
local binding and backend address.

Browser checks require a current production build and Playwright's Chromium:

```bash
vp run -F @adrian-zephyr-notes/website build
vp exec -F @adrian-zephyr-notes/website playwright install chromium
vp run -F @adrian-zephyr-notes/website test:browser
```

The suite starts the actual standalone website on port 3104 and a fixed-response
API fixture on port 4311. It covers layout, keyboard navigation, theme persistence,
touch cover navigation, archive URLs, discussion read failures, light/dark axe
accessibility scans, and keyboard access to reading navigation and wide tables. It does not
verify database behavior or production authentication. Failed tests retain traces
and screenshots in `test-results/`; CI uploads those artifacts for seven days.
