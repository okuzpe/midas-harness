# Hygiene sweep sweep-17

Ran: 2026-08-07 · Tier: build · Scope: `rules`+`docs` · Depth: `standard`  
Stage snapshot: `sprint_execution` / `not_started` · mode: `brownfield` · midas_version: `2.6.1`  
**Follows:** sweep-16 · triggered by `/loop` 10m tick #14

## Findings

| # | Severity | Category | Path | Note | Disposition |
|---|----------|----------|------|------|-------------|
| 1 | high | harness-drift | `harness/rules/testing.md` | gstack gap: no mandatory regression proof for bug fixes. | **fixed** — CHECK + Amendment |
| 2 | medium | stale-doc | `docs/gstack-comparison.md` | Still listed regression as open in §6.1 / §8.3. | **fixed** — marked shipped |

## Deferred

| # | Note |
|---|------|
| D1 | Orchestrate re-attest audit-02/03. |
| D2 | `/midas-investigate`, careful/freeze/guard, `/midas-doc` still open. |

MIDAS_SWEEP_RESULT: dead_flows=0 orphans=0 ledger_drift=0 stale_docs=0 harness_drift=0 hygiene=0 verdict=fixed

## Disposition

fixed — Phase-7 bug fixes now require regression evidence without auto-fixing like gstack `/qa`.
