# Sprint 01 — autonomy-ci-smoke

| Field | Value |
|---|---|
| **Sprint number** | 01 |
| **Status** | planned |
| **Started** | — |
| **Target close** | — |
| **Depends on** | none |

## Goal

Add a structural test that installs Midas with `--autonomy` into a temp directory and runs one
`midas-autopilot` tick with `--runner=fake`, proving ADR-009 P0 is CI-smokeable without cloud tokens.

## Scope / non-scope

**In:** test fixture under `scripts/test.mjs` or dedicated fixture dir; minimal doc note in
`harness/autonomy/pilot.md` referencing the test id.

**Out:** Cursor Cloud runner in CI; TaskPilot product changes; autonomy P1 profiles.

## Acceptance criteria

- [ ] WHEN `node scripts/test.mjs` runs, an autonomy install + fake tick test SHALL pass.
- [ ] WHEN the test uses `--runner=fake`, it SHALL NOT require `CURSOR_API_KEY` or cloud credentials.
- [ ] WHEN the fixture completes, `{product}/features.json` feature F-001 MAY flip to `passing` with test path evidence.

## Definition of Done (DoD)

- [ ] All acceptance criteria above are met.
- [ ] New/changed behaviour has a passing automated test (`harness/rules/testing.md`).
- [ ] No structural invariant regressions (`harness/rules/change-propagation.md` — run `npm run align`).
- [ ] No secrets committed (`harness/rules/security.md`).
- [ ] `product/features.json` F-001 updated (`status`, `evidence`) if criteria met.
- [ ] `{runs}/sprints/01-progress.md` started on `/start-sprint` (Phase 7).

## Tasks

| # | Task | Tier | Status | Notes |
|---|------|------|--------|-------|
| 1 | Add temp-dir install fixture with `--autonomy` flag | build | todo | reuse create-midas patterns |
| 2 | Run `midas-autopilot.mjs setup` + one `--runner=fake` tick | build | todo | playbook: `harness/autonomy/pilot.md` |
| 3 | Wire test id into `scripts/test.mjs` with clear failure message | build | todo | |
| 4 | Cross-reference test id in `harness/autonomy/pilot.md` | build | todo | |

## Blockers

- none

## Phase 8 audit notes

- **Audit file:** `{runs}/audits/audit-01.md`
- **Verdict:** pending
