# Sprint 01 — Auth + task CRUD

| Field | Value |
|---|---|
| Sprint ID | `01` |
| Status | done |
| Dates | 2026-06-16 → 2026-06-27 |
| Goal | A user can register, log in, create a workspace, and perform full CRUD on tasks |
| Tier | build (claude-sonnet-4-6) |
| Closing audit | `.harness/audits/audit-01.md` — verdict **PASS** (1 logged amendment) |

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
| T-03 | Implement `POST /api/auth/register` (bcrypt, session create) | builder | done |
| T-04 | Implement `POST /api/auth/login` and `DELETE /api/auth/logout` | builder | done |
| T-05 | Implement `POST /api/tasks`, `GET /api/tasks`, `PATCH /api/tasks/[id]`, `DELETE /api/tasks/[id]` | builder | done |
| T-06 | Auth middleware (`middleware.ts`) — redirect unauthenticated users | builder | done |
| T-07 | Stub `/board` page (server component; lists task titles from DB) | builder | done |
| T-08 | Unit tests: schema shape, session helpers, password helpers | builder | done |
| T-09 | Integration test: full register → create-task → list-tasks flow | builder | done |

**Playbooks followed** (`product/playbooks/`): T-01–T-02 → `add-drizzle-migration`; T-03–T-05 → `add-api-route`.

---

## Acceptance criteria

<!-- EARS form (see harness/conventions.md § Acceptance criteria). All met — see audit-01.md. -->

- [x] WHEN a `POST /api/auth/register` arrives with a valid email + password, the system SHALL return
      201, set the session cookie, and create the user + workspace in the DB.
- [x] WHEN a `POST /api/auth/login` arrives with valid credentials, the system SHALL return 200 and
      set the session cookie.
- [x] WHEN a `DELETE /api/auth/logout` arrives, the system SHALL clear the session cookie and delete
      the session row.
- [x] WHEN a `POST /api/tasks` arrives with a valid session, the system SHALL create a task scoped to
      the caller's workspace and return 201 with the full task record.
- [x] WHEN a `GET /api/tasks` arrives, the system SHALL return only tasks belonging to the current
      workspace (tenant isolation).
- [x] WHEN a `PATCH /api/tasks/[id]` targets a task in another workspace, the system SHALL return 404.
- [x] WHEN a `DELETE /api/tasks/[id]` targets a task not in the current workspace, the system SHALL
      return 404.
- [x] WHEN any API route is called without a valid session, the system SHALL return 401.
- [x] WHEN an unauthenticated request hits an app page, the middleware SHALL redirect it to `/login`.
- [x] The system SHALL apply all Drizzle migrations cleanly on a fresh Postgres instance.

---

## Definition of Done (DoD)

The sprint is done when **all** of the following are true:

1. **Acceptance criteria** — every checkbox above is checked with evidence (test output or manual
   verification note).
2. **Tests pass** — `npm run test` exits 0; no skipped tests that cover sprint-2 requirements.
3. **Conformance** — Phase 8 audit (`audit-01.md`) run by midas-orchestrator finds no unresolved
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
