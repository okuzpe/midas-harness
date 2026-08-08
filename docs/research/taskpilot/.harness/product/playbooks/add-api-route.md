# Playbook: Add an API route

| Field | Value |
|---|---|
| **Use when** | Adding a new endpoint under `src/app/api/` (a new resource, or item ops on an existing one) |
| **Trigger** | any added/changed `src/app/api/**/route.ts` |
| **Stack** | next.js@15.3.x (App Router route handlers) · drizzle-orm@0.40.x — Context7-verified |
| **Owner tier** | build |

## Steps

1. Create `src/app/api/<resource>/route.ts` for collection ops (`GET`/`POST`), or
   `src/app/api/<resource>/[id]/route.ts` for item ops (`PATCH`/`DELETE`; `params` is a `Promise`).
2. **Authenticate first:** `const session = await requireSession(request);` and return
   `401` when it is `null` — every handler, no exceptions.
3. **Validate at the boundary:** wrap `request.json()` in `try/catch` → `400` on bad JSON; check each
   field → `422` with a message before any DB call. Build the DB object from allowed fields only (never
   spread untrusted `body`).
4. **Scope every query by `session.workspaceId`** (tenant isolation). For item ops, filter by
   `and(eq(table.id, id), eq(table.workspaceId, session.workspaceId))`; a miss returns `404` — never
   reveal that a row exists in another workspace.
5. Return the right status: `201` + record on create, `200` on read/update, `204` on delete.
6. Add/extend the integration test (`route.test.ts`) mocking `@/lib/db` + `@/lib/auth/session`:
   assert `401` without a session, the validation failure, and that writes carry `workspaceId`.

## Must honor

- **Rules:** scope every query by `workspaceId` and never reveal cross-tenant existence
  (`harness/rules/security.md`); validate-at-boundaries and no silent catch
  (`harness/rules/code-quality.md`); the route imports only `@/lib/*`, never an `app/` page
  (`harness/rules/code-quality.md`).
- **Context7:** fetch `next.js@15.3.x` "route handlers" and `drizzle-orm@0.40.x` "select/insert" before
  writing — never code the API from memory (`harness/rules/context7-usage.md`).

## Done when

- [ ] Unauthenticated request → `401`; invalid body → `422` (bad JSON → `400`).
- [ ] Every query is filtered by `session.workspaceId`; cross-workspace item op → `404`.
- [ ] The integration test covers the 401 / validation / scoping paths and passes.
- [ ] All applicable `harness/rules/*` still pass (audited in Phase 8).
