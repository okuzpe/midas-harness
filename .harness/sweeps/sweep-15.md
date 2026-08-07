# Hygiene sweep sweep-15

Ran: 2026-08-07 · Tier: build · Scope: `code`+`docs` · Depth: `standard`  
Stage snapshot: `sprint_execution` / `not_started` · mode: `brownfield` · midas_version: `2.6.1`  
**Follows:** sweep-14 · triggered by `/loop` 10m tick #12

## Findings

| # | Severity | Category | Path | Note | Disposition |
|---|----------|----------|------|------|-------------|
| 1 | medium | hygiene | `scripts/status-page.mjs` | Status HTML omitted sweeps/retros/lean/improve-loop after those runs dirs shipped. | **fixed** |
| 2 | low | stale-doc | `docs/faq.md` | No FAQ distinguishing `/midas-retro` vs `/close-sprint`. | **fixed** |

## Deferred

| # | Note |
|---|------|
| D1 | Orchestrate re-attest audit-02/03. |

MIDAS_SWEEP_RESULT: dead_flows=0 orphans=0 ledger_drift=0 stale_docs=0 harness_drift=0 hygiene=0 verdict=fixed

## Disposition

fixed — status page covers new evidence dirs; FAQ clarifies retro vs Phase-8.
