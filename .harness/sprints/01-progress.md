# Sprint progress — 01-autonomy-ci-smoke

**Sprint:** 01 — autonomy-ci-smoke  
**Last updated:** 2026-08-07

## Done

| Task | Proof | Tool | Route |
|---|---|---|---|
| Install + fake tick E2E test | `autonomy:install-smoke-exit`, `autonomy:install-fake-tick-smoke` in `scripts/test.mjs` | test-runner | inline |
| pilot.md cites CI test id | `harness/autonomy/pilot.md` § P0 protocol | smoke | inline |

## Next

Run `/close-sprint` after gate audit (Phase 8).

## Observations

### 2026-08-07 — Installer path already partially tested

| Field | Content |
|---|---|
| **What** | Added E2E linking `create-midas --autonomy` to `setup` + `tick --runner=fake` |
| **Why** | Sprint 01 acceptance; complements manual `cpSync` fixture earlier in the same test block |
| **Where** | `scripts/test.mjs` (~autonomy:install-fake-tick-smoke) |
| **Learned** | Fresh install defaults `idea_intake`; smoke patches state + sprint file before tick |
