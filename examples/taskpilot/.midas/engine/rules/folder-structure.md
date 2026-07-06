<!-- Phase 5 generated stack rule (TaskPilot: Next.js 15 App Router + Drizzle + Neon Postgres). -->

# Rule: Folder structure & layer boundaries (Next.js App Router)

> docs: next.js@15.3.x via Context7

The codebase lives under `product/src/`. Routing/UI is the outer layer; `lib/` is the inner layer.
Dependencies point **inward only** — a diff can be checked against this.

## Canonical tree

```
product/src/
  app/                       # Next.js App Router — routes, layouts, route handlers
    (app)/...                # authenticated UI route group (e.g. board/page.tsx)
    api/<resource>/route.ts  # collection handlers (GET/POST)
    api/<resource>/[id]/route.ts   # item handlers (PATCH/DELETE)
  lib/
    db/                      # Drizzle schema + client (schema.ts, index.ts)
    auth/                    # session + password (session.ts, password.ts)
  middleware.ts              # route protection (redirect unauthenticated)
```

## Requires

- UI/route code (`app/**`) may import from `lib/**`; **`lib/**` must never import from `app/**`**.
- Route handlers reach persistence/auth only via `@/lib/*` — never into another route's files.
- `middleware.ts` imports only the shared cookie/session constants, not handler internals.

## CHECK

- **CHECK:** `grep -rnE "from ['\"]@/app|from ['\"]\.\./app" product/src/lib` returns nothing (no
  inner-layer file imports the outer layer).
- **CHECK:** `manual:` every `app/api/**/route.ts` imports persistence/auth only through `@/lib/*`.

## Linter form (the machine-readable CHECK)

- `manual-only` — Biome has no import-boundary rule; the grep above is the mechanical check (also run in
  CI). With ESLint, `eslint-plugin-boundaries` would encode it.
