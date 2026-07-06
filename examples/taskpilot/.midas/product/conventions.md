# TaskPilot conventions (project overrides)

Project-specific prose conventions that **override/extend** the base `harness/conventions.md`. The
checkable constraints live in `harness/rules/*` (folder-structure, tenant-isolation, session-cookies)
and the base always-on rules; this file is the narrative they encode — it never restates the base.

Precedence (from `harness/conventions.md`):
`stack-specific rules > product/conventions.md > product/design-system.md > base conventions`.

## Stack
Next.js 15.3 (App Router) · TypeScript · Drizzle ORM 0.40 · Neon Postgres · bcrypt 5.1 · Vercel. All
third-party APIs are Context7-verified at these pinned versions before use
(`harness/rules/context7-usage.md`); each call site carries a `// docs: <lib>@<version> via <tool>` note.

## Naming & files
- Route handlers: `src/app/api/<resource>/route.ts` (collection) / `[id]/route.ts` (item).
- `lib/` modules are camelCase functions named for effect (`requireSession`, `createSession`).
- DB columns: snake_case in Postgres, camelCase in the Drizzle schema (types inferred from the schema).

## Errors & boundaries
- Validate at the route boundary: bad JSON → `400`, invalid fields → `422`, before any DB call.
- Build write objects from allowed fields only — never spread untrusted `body`.
- The layer boundary is enforced by `harness/rules/folder-structure.md` (`lib/` never imports `app/`).

## Security overrides
- **Tenant isolation** is non-negotiable — see `harness/rules/tenant-isolation.md`.
- **Account-enumeration resistance:** `login` returns a single generic `401` for both unknown email and
  wrong password (audited as R-15); never branch the error by which check failed.
- **Sessions:** see `harness/rules/session-cookies.md`.

## Testing
- Vitest. Each route handler gets an integration test mocking `@/lib/db` + `@/lib/auth/session`;
  assert the 401 / validation / `workspaceId`-scoping paths. Test behaviour at the boundary.
