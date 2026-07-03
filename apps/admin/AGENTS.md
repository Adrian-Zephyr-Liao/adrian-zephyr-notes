# Admin App Guidelines

## Product Direction

The admin app is a content workspace for AZ Notes, not a traditional dense B-side back office.

- Match the website visual language: calm editorial surfaces, glass tokens, rounded 8px-ish controls, restrained color, and the same light/dark theme variables.
- Prefer shadcn/ui-style primitives built from local React components and Tailwind utilities.
- Do not introduce new Ant Design UI for admin surfaces. Existing Ant Design usage should be migrated out as features are touched.
- Keep pages content-first: prioritize article writing, review, moderation, and configuration workflows over dashboard decoration.

## UI Architecture

- Place reusable primitives in `src/components/ui`.
- Place layout and shell components in `src/components/admin`.
- Place feature workflows in `src/features/<feature>`.
- Keep feature components focused. Split large editor, list, preview, and action components before they become hard to review.
- Keep visual tokens in `src/styles.css`, aligned with `apps/website/src/app/globals.css`.
- Use `lucide-react` icons for actions when an icon exists.
- Use native buttons, inputs, dialogs, menus, and forms through local shadcn-style wrappers; keep accessibility attributes explicit.

## Markdown Editing

- Article Markdown creation, editing, and preview must use `@adrian-zephyr-notes/markdown`.
- Import the shared markdown stylesheet in admin styles so frontstage and backstage rendering stay aligned.
- Do not duplicate Markdown rendering logic in admin.
- The article editor must support create, read, update, and delete flows through admin APIs.

## API Boundaries

- Admin frontend code must call backend APIs only through `src/lib/admin-api.ts` or a feature-local client that wraps it.
- Shared request/response shapes belong in `packages/contracts`.
- Do not import Prisma, Nest DTOs, backend domain models, or repository interfaces into admin code.
- For auth and cookie-sensitive website flows, use the existing app-specific proxy approach. For admin, use the configured backend API base URL and backend CORS.

## Environment Switching

The repo keeps environment presets as copy sources:

- `.env.localhost`: local-only development preset.
- `.env.ngrok`: temporary public preview preset.
- `.env`: the active runtime file used by development commands.

When switching environments, copy the desired preset over `.env`; do not expect tools to read `.env.ngrok` or `.env.localhost` directly. For ngrok preview work, use:

```bash
cp .env.ngrok .env
cp .env.ngrok apps/server/.env
```

For localhost work, use:

```bash
cp .env.localhost .env
cp .env.localhost apps/server/.env
```

Keep preset files committed as templates and treat `.env` / `apps/server/.env` as the current selected environment.

During implementation, localhost is acceptable for fast browser checks. Before handing off work that the user needs to inspect remotely, switch the active env back to ngrok, restart the needed services, expose the correct frontend, and verify the public URL.

## Backend Architecture Expectations

When admin work requires server changes, keep the existing DDD shape:

- `domain`: entities, value objects, local domain types, repository ports, and domain errors.
- `application`: use cases and orchestration over domain ports.
- `infrastructure`: Prisma repositories, external clients, and mappers.
- `presentation`: Nest controllers, guards, decorators, and DTO boundary validation.

`packages/contracts` is only for HTTP contracts shared across apps.

## Verification

For admin changes, run the narrowest useful checks first, then full gates before handoff:

- `vp run -F @adrian-zephyr-notes/admin typecheck`
- `vp run -F @adrian-zephyr-notes/admin build`
- `vp check`
- `vp test`

When server contracts or Prisma code changes, also run:

- `vp run db:generate`
- `vp run -F @adrian-zephyr-notes/server typecheck`
- `vp run -F @adrian-zephyr-notes/server build`
