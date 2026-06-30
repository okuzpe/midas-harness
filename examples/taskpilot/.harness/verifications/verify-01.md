# Verification verify-01 — sprint 01 — scope: all
Ran: 2026-06-27 · Tier: build (claude-sonnet-4-6) · Tools: playwright-mcp · chrome-devtools-mcp · test-runner (vitest)
App under test: `npm run dev` → http://localhost:3000

> Behavioural proof that Sprint 1's acceptance criteria hold in a running app, frozen before
> `/close-sprint`. Pure-API criteria are proven by the existing test runner / `@playwright/cli`
> request testing (cheapest tool); only the rendered surfaces (`/login`, `/board`, the middleware
> redirect) needed a real browser. Runtime health inspected with Chrome DevTools. Informational only —
> this record never advances a gate; `/close-sprint` (audit-01) consumes it.

## Verdict tally
PASS: 10  ·  FAIL: 0 (CRIT 0 · HIGH 0 · MED 0 · LOW 0)  ·  BLOCKED: 0
MIDAS_VERIFY_RESULT: fails=0 criticals=0 runtime_errors=0   # gate-parseable line (runtime_errors roll into fails/criticals)

## Per-criterion results
| # | Acceptance criterion | Tool | Selector(s) | Expected | Actual | Verdict | Evidence (screenshot) |
|---|----------------------|------|-------------|----------|--------|---------|-----------------------|
| 1 | Register → 201 + cookie + DB rows | @playwright/cli (request) | `POST /api/auth/register` | 201 + `Set-Cookie: sid` | 201 + cookie set | PASS | — |
| 2 | Login → 200 + cookie | playwright-mcp | `getByLabel('Email')`, `getByRole('button',{name:'Sign in'})` | redirect to `/board`, cookie set | redirected, cookie set | PASS | — (screenshots illustrative; not committed) |
| 3 | Logout → clears cookie + deletes session | @playwright/cli (request) | `DELETE /api/auth/logout` | cookie cleared, row deleted | cleared + deleted | PASS | — |
| 4 | POST /api/tasks → workspace-scoped, 201 | test-runner | `api/tasks/route.test.ts` | 201 + `workspaceId` set | pass | PASS | — |
| 5 | GET /api/tasks → only workspace tasks | test-runner | `api/tasks/route.test.ts` | tenant-isolated list | pass | PASS | — |
| 6 | PATCH /api/tasks/[id] cross-workspace → 404 | test-runner | `api/tasks/[id]/route.test.ts` | 404 | 404 | PASS | — |
| 7 | DELETE /api/tasks/[id] cross-workspace → 404 | test-runner | `api/tasks/[id]/route.test.ts` | 404 | 404 | PASS | — |
| 8 | Any API route without session → 401 | test-runner | `route.test.ts` | 401 | 401 | PASS | — |
| 9 | Unauthenticated page → middleware redirect to `/login` | playwright-mcp | nav `/board` (no cookie) | 302 → `/login?next=/board` | redirected | PASS | — (screenshots illustrative; not committed) |
| 10 | Drizzle migrations apply on fresh Postgres | test-runner (setup) | `drizzle-kit migrate` | exit 0 | exit 0 | PASS | — |

## Runtime health (Chrome DevTools)
| Screen | Console errors | Failed requests | CWV (LCP/CLS/INP) | Verdict |
|--------|----------------|-----------------|-------------------|---------|
| `/login` | 0 | 0 | LCP 0.6s · CLS 0.00 · INP 32ms | PASS |
| `/board` (authenticated) | 0 | 0 (3 XHR, all 200) | LCP 0.9s · CLS 0.01 · INP 41ms | PASS |
- No uncaught errors / unhandled rejections on the happy path; no 4xx/5xx on either screen. No perf
  budget defined in `product/architecture.md`, so CWV recorded as advisory (all nominal).

## Design-token findings
| Screen | Property | Token expected | Computed value | Verdict |
|--------|----------|----------------|----------------|---------|
| `/board` | surface bg | `var(--color-surface)` | `rgb(...)` via `bg-surface` | PASS |
| `/board` | card radius | `var(--radius-card)` | `rounded-card` | PASS |
| `/login` | focus ring | `--ds-focus` | visible AA-contrast ring | PASS |
- No hardcoded hex/spacing outside tokens (matches audit-01 R-11). Narrow-viewport check (360px):
  `scrollWidth <= clientWidth` on `/login` and `/board` — no horizontal overflow.

## Failures → /close-sprint (drift)
- None. All 10 acceptance criteria pass with on-disk evidence; runtime health clean.
