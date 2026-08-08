# Hygiene sweep sweep-13

Ran: 2026-08-07 · Tier: build · Scope: `docs`+`code` · Depth: `standard`  
Stage snapshot: `sprint_execution` / `not_started` · mode: `brownfield` · midas_version: `2.6.1`  
**Follows:** sweep-12 · triggered by `/loop` 10m tick #10

## Findings

| # | Severity | Category | Path | Note | Disposition |
|---|----------|----------|------|------|-------------|
| 1 | medium | stale-doc | `docs/getting-started.md` | Lifecycle list omitted post-sprint standing skills (retro/sweep/improve-loop). | **fixed** |
| 2 | low | hygiene | `.harness/audits/audit-01.md` | Verdict Next still `/start-sprint 02` after 02–03 shipped. | **fixed** — Amendment |
| 3 | low | ledger-drift | `scripts/test.mjs` | No lock that dogfood retros exist for sprints 01–03. | **fixed** |

## Deferred

| # | Note |
|---|------|
| D1 | Orchestrate re-attest audit-02/03. |

MIDAS_SWEEP_RESULT: dead_flows=0 orphans=0 ledger_drift=0 stale_docs=0 harness_drift=0 hygiene=0 verdict=fixed

## Disposition

fixed — onboarding + historical audit pointer + retro presence locks.

## Amendment

- **2026-08-08** — Finding path `.harness/audits/audit-01.md` maps to `runs/audits/audit-01.md`
  after engine dogfood `paths.runs` migration.
