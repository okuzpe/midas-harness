<!-- Phase 5 generated stack rule (TaskPilot). The headline multi-tenant safety invariant (audited as R-13). -->

# Rule: Tenant isolation — scope every query by workspaceId (Drizzle/Postgres)

> docs: drizzle-orm@0.40.x via Context7

TaskPilot is multi-tenant by `workspaceId`. Every read/write of workspace-owned data MUST be filtered by
the caller's `session.workspaceId`; a cross-workspace target returns `404` and never reveals existence.

## Requires

- Collection reads/writes filter by `eq(table.workspaceId, session.workspaceId)`.
- Item ops use `and(eq(table.id, id), eq(table.workspaceId, session.workspaceId))`; an empty result → `404`.
- Never build a write object by spreading untrusted `body`; set `workspaceId` from the session only.

## CHECK

- **CHECK:** `grep -rnE "db\.(select|update|delete|insert)" product/src/app/api` — every workspace-scoped
  query carries a `workspaceId` predicate (reviewer confirms each hit).
- **CHECK:** the integration test asserts a cross-workspace item op returns `404`
  (`product/src/app/api/tasks/route.test.ts`).

## Linter form (the machine-readable CHECK)

- `manual-only` — no off-the-shelf lint rule proves tenant scoping; enforced by the `add-api-route`
  playbook's done-when, the Phase-8 audit (R-13), and the integration test in CI.
