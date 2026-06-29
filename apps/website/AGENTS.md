<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Website Source Layout

Follow Next.js App Router boundaries and keep product code outside `app` unless it is route-specific.

- `src/app`: routes, layouts, metadata, loading/error/not-found UI, and route handlers.
- `src/components/ui`: shadcn/ui primitives and small design-system building blocks only.
- `src/components/site`: app shell components shared across website pages, such as Header, Footer, theme controls, and global navigation.
- `src/features`: interactive workflows such as search, comments, authentication, or theme behavior when they grow beyond shell controls.
- `src/entities`: domain-centered UI, model types, and adapters for posts, categories, tags, authors, and similar blog concepts.
- `src/shared`: stable cross-cutting utilities, config, constants, API clients, and styling helpers.

## Component Directory Pattern

For any multi-file component, prefer a directory with a stable `index.tsx` export:

```txt
components/site/site-header/
  index.tsx
  site-header.tsx
  site-brand.tsx
  desktop-nav.tsx
  mobile-menu.tsx
  data.ts
  styles.ts
  types.ts
```

Rules:

- Public imports should use the directory entrypoint, for example `@/components/site/site-header`.
- Internal component files should use relative imports, such as `./data` and `./types`.
- Keep static config in `data.ts`, local type contracts in `types.ts`, and shared class strings or local styling constants in `styles.ts`.
- Keep `components/ui` free of website-specific routes, copy, data, and product interactions.
- Keep Tailwind CSS variable classes in canonical form, for example `bg-(--glass-surface)` and `border-(--glass-border)`.
