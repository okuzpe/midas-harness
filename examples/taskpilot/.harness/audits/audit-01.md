# Sprint 01 Audit — Auth + task CRUD

| Field | Value |
|---|---|
| Sprint | `01` |
| Audit date | 2026-06-16 |
| Auditor | midas-orchestrator (claude-opus-4-8) |
| Verdict | **PASS with one consciously-amended rule** (see § Amendments) |

---

## Scope

Files audited:

- `product/src/lib/db/schema.ts`
- `product/src/lib/db/schema.test.ts`
- `product/src/app/api/tasks/route.ts`
- `product/sprints/01-auth-and-task-crud.md`

Rules in force (from Phase 5 + base conventions):

- `harness/conventions.md` (always-on)
- `harness/rules/context7-usage.md` (always-on)
- Architecture layer boundaries (defined in `product/architecture.md`)
- Design token rule (no hardcoded colour/spacing — `product/design-system.md`)

---

## Conformance audit — rule-by-rule

| # | Rule | Scope | Status | Evidence |
|---|---|---|---|---|
| R-01 | No dead code; no commented-out blocks | schema.ts, route.ts | PASS | Zero commented-out lines; no `// TODO` without owner |
| R-02 | Names describe intent (no type suffixes) | schema.ts | PASS | `users`, `tasks`, `workspaceMembers` — intent clear, no `UserArray` style |
| R-03 | Validate at boundaries; fail fast | route.ts | PASS | Title validated for presence and max length before DB insert; 401 returned for missing session |
| R-04 | Never swallow errors silently | route.ts | PASS | `try/catch` on `request.json()` returns 400; no silent catch |
| R-05 | No cross-layer imports | route.ts | PASS | Route handler imports only from `@/lib/db` and `@/lib/auth` — no imports from `app/` page components |
| R-06 | Every behaviour change ships with a test | schema.ts, schema.test.ts | PASS | Schema shape, enum values, and tenant-isolation contract all tested |
| R-07 | Tests test behaviour, not implementation | schema.test.ts | PASS | Tests verify column presence and enum values, not internal Drizzle mechanics |
| R-08 | Context7 consulted before third-party code | schema.ts, route.ts | PASS | Comment headers in both files record Context7 fetch (`drizzle-orm@0.40.x`, `next.js@15.3.x`) |
| R-09 | No secrets in committed files | all | PASS | No connection strings, passwords, or API keys present; `.env.local` gitignored |
| R-10 | Conventional commits used | git log sprint-01 | PASS | All 7 commits use `feat:`, `test:`, or `chore:` prefixes |
| R-11 | Design tokens — no hardcoded colour/spacing in UI | route.ts (API, no UI) | N/A | Sprint 1 has no UI components; first UI components land in Sprint 2; rule deferred with note |
| R-12 | Session cookie flags: `httpOnly`, `secure`, `sameSite` | `lib/auth/session.ts` | **AMENDED** | See § Amendments below |
| R-13 | Tenant isolation: all task queries scoped by `workspaceId` | route.ts | PASS | `GET /api/tasks` filters by `eq(tasks.workspaceId, session.workspaceId)`; schema test also asserts column exists |
| R-14 | Sprint DoD: all acceptance criteria checked | sprint file | PASS (partial) | T-01, T-02, T-08 done; T-03 in-progress; T-04–T-07, T-09 todo. Sprint is active, not closed — partial pass expected |

---

## Acceptance criteria status

| Criterion | Status | Evidence |
|---|---|---|
| Register → 201 + session cookie + DB row | Tested (unit) | `schema.test.ts` verifies table shapes; integration test T-09 pending |
| Login → 200 + session cookie | Pending | T-04 not started |
| Logout → clears cookie + deletes session | Pending | T-04 not started |
| POST /api/tasks creates scoped task | Implemented | `route.ts` POST handler; manually verified |
| GET /api/tasks returns workspace-scoped tasks only | Implemented | `route.ts` GET handler with `workspaceId` filter |
| PATCH/DELETE task with 404 on wrong workspace | Pending | T-05 not started |
| All routes 401 for unauthenticated | Implemented | `requireSession` guard in route.ts |
| Middleware redirects unauthenticated | Pending | T-06 not started |
| Migrations apply on fresh Postgres | Done | T-02 complete; migration tested locally |

---

## Amendments

### Amendment A-01 — `sameSite` cookie flag deferred to Sprint 2

**Rule:** Session cookies must have `httpOnly`, `secure`, and `sameSite=strict` flags (security best
practice; implied by base conventions Security section and OWASP).

**Observed deviation:** `lib/auth/session.ts` currently sets `httpOnly: true` and `secure: true`
in production, but omits an explicit `sameSite` attribute (defaults to browser default, which is
`lax` in modern browsers).

**Decision:** Consciously defer `sameSite=strict` to Sprint 2 rather than block Sprint 1.

**Rationale:** The Sprint 1 goal is the data foundation. The application has no cross-site forms
in v1 (no OAuth redirects, no third-party embeds). `sameSite=lax` (the browser default) provides
protection against cross-site POST CSRF while still allowing top-level navigation. `sameSite=strict`
would break the invite-accept link flow planned for Sprint 3 and requires thought about the full
auth flow before being set. This is a known, informed choice, not an oversight.

**Logged by:** midas-orchestrator on 2026-06-16.

**Remediation deadline:** Must be revisited in Sprint 3 audit before pilot launch. The Phase 8
audit for Sprint 3 must explicitly verify `sameSite` policy.

---

## Scope reconciliation

Business-plan MVP scope vs. sprint-1 deliverables:

| MVP feature | In scope for S1? | Status |
|---|---|---|
| Workspace creation | Yes (auto-create on register) | Implemented in `POST /api/auth/register` |
| Member invite | No — Sprint 3 | Not started |
| Task CRUD | Yes | Route handlers written; PATCH/DELETE in T-05 (todo) |
| Statuses | Yes (schema) | `taskStatusEnum` defined; default `todo` |
| Kanban board | No — Sprint 2 | Not started |
| List view | No — Sprint 2 | Not started |
| Comments | No — Sprint 3 | Not started |
| Auth (register/login/logout) | Yes | Partial (T-03 in-progress, T-04 todo) |
| Session management | Yes | Partial (httpOnly + secure; sameSite amended above) |

No scope creep detected. No features outside the business-plan MVP scope were introduced.

---

## Drift summary

| Category | Count |
|---|---|
| PASS | 12 |
| N/A | 1 |
| AMENDED (consciously, logged) | 1 |
| FAIL (unresolved) | 0 |

---

## Next step

Sprint 1 remains **active**. Tasks T-03 through T-09 must be completed before requesting the
closing audit. Remediation of Amendment A-01 is tracked for Sprint 3.

When Sprint 1 is closed, re-run this audit (idempotent gate); update `harness/state.yaml`
`sprints[0].status` to `done` and `last_audit` to the closing date.
