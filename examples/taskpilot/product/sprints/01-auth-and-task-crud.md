# Sprint 01 — Auth + task CRUD

| Field | Value |
|---|---|
| Sprint ID | `01` |
| Status | active |
| Dates | 2026-06-16 → 2026-06-27 |
| Goal | A user can register, log in, create a workspace, and perform full CRUD on tasks |
| Tier | build (claude-sonnet-4-6) |

---

## Goal statement

By the end of this sprint, a developer can:
1. Run `npm run db:migrate` and get a fully-migrated Postgres schema.
2. Register a user via `POST /api/auth/register`, log in, and receive a session cookie.
3. Create, read, update, and delete tasks via the REST API.
4. See a stub UI page (`/board`) that lists tasks for the authenticated user's workspace.

No polish, no kanban drag-and-drop — that is Sprint 2. This sprint is about the data foundation.

---

## Tasks

| # | Task | Assignee | Status |
|---|---|---|---|
| T-01 | Write Drizzle schema (`users`, `workspaces`, `workspace_members`, `tasks`, `sessions`) | builder | done |
| T-02 | Generate and apply initial migration | builder | done |
| T-03 | Implement `POST /api/auth/register` (bcrypt, session create) | builder | in-progress |
| T-04 | Implement `POST /api/auth/login` and `DELETE /api/auth/logout` | builder | todo |
| T-05 | Implement `POST /api/tasks`, `GET /api/tasks`, `PATCH /api/tasks/[id]`, `DELETE /api/tasks/[id]` | builder | todo |
| T-06 | Auth middleware (`middleware.ts`) — redirect unauthenticated users | builder | todo |
| T-07 | Stub `/board` page (server component; lists task titles from DB) | builder | todo |
| T-08 | Unit tests: schema shape, session helpers, password helpers | builder | in-progress |
| T-09 | Integration test: full register → create-task → list-tasks flow | builder | todo |

---

## Acceptance criteria

- [ ] `POST /api/auth/register` with valid email + password returns 201, sets session cookie, creates
      user + workspace in DB.
- [ ] `POST /api/auth/login` with valid credentials returns 200, sets session cookie.
- [ ] `DELETE /api/auth/logout` clears session cookie and deletes session from DB.
- [ ] `POST /api/tasks` with a valid session creates a task scoped to the user's workspace; returns
      201 with the full task record.
- [ ] `GET /api/tasks` returns only tasks belonging to the current workspace (tenant isolation).
- [ ] `PATCH /api/tasks/[id]` updates allowed fields; returns 404 if task belongs to another workspace.
- [ ] `DELETE /api/tasks/[id]` deletes the task; returns 404 if not found in current workspace.
- [ ] All API routes return 401 for unauthenticated requests.
- [ ] Middleware redirects unauthenticated requests to `/login`.
- [ ] All Drizzle migrations apply cleanly on a fresh Postgres instance.

---

## Definition of Done (DoD)

The sprint is done when **all** of the following are true:

1. **Acceptance criteria** — every checkbox above is checked with evidence (test output or manual
   verification note).
2. **Tests pass** — `npm run test` exits 0; no skipped tests that cover sprint-2 requirements.
3. **Conformance** — Phase 8 audit (`audit-01.md`) run by keel-orchestrator finds no unresolved
   `fail` rows. Any `fail` is either fixed or consciously amended and logged.
4. **No dead code** — no commented-out blocks, no unused imports (enforced by `eslint`
   `no-unused-vars`).
5. **No secrets** — `git diff` contains no API keys, passwords, or connection strings; `.env.local`
   is gitignored.
6. **Conventional commits** — all commits in this sprint use `feat:`, `fix:`, `test:`, or `chore:`
   prefixes.
7. **Design tokens** — any UI element introduced references CSS token variables; no hardcoded
   colour or spacing values (verified in audit).
8. **Architecture compliance** — no cross-layer imports (e.g. route handlers do not import from
   `app/` page components; `lib/` utilities do not import from `app/`).

---

## Risks for this sprint

| Risk | Mitigation |
|---|---|
| Drizzle migration rollback on Neon is tricky | Keep migrations small and additive; no destructive `ALTER TABLE` in sprint 1 |
| Session cookie security misconfiguration | Reference OWASP session management cheat sheet; Phase 8 security audit will verify `httpOnly`, `secure`, `sameSite` flags |
