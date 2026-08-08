# Hygiene sweep sweep-19

Ran: 2026-08-07 · Tier: build · Scope: `skills`+`docs` · Depth: `standard`  
Stage snapshot: `sprint_execution` / `not_started` · mode: `brownfield` · midas_version: `2.6.1`  
**Follows:** sweep-18 · triggered by `/loop` 10m tick #16

## Findings

| # | Severity | Category | Path | Note | Disposition |
|---|----------|----------|------|------|-------------|
| 1 | high | harness-drift | `harness/skills/` | gstack `/midas-investigate` still open. | **fixed** — skill + template + playbook |
| 2 | medium | stale-doc | catalogs / FAQ / gstack | Investigate not listed. | **fixed** |

## Skill quality — midas-investigate (leaf)

```
Skill quality: midas-investigate (leaf)  Mode: standard  Score: 34/40  🟢 Ship
Hard fails: none
Core floors: ok (Trigger 4, Structure 4, Completion 3, Safety 4)
Evidence: frontmatter name/description/disable-model-invocation; Does/Does not; Iron Law; Exit gate; Tier & delegation; When NOT
```

## Deferred

| # | Note |
|---|------|
| D1 | Orchestrate re-attest audit-02/03. |
| D2 | `/midas-doc` (Diataxis) still open. |

MIDAS_SWEEP_RESULT: dead_flows=0 orphans=0 ledger_drift=0 stale_docs=0 harness_drift=0 hygiene=0 verdict=fixed

## Disposition

fixed — Iron Law investigations freeze under `{runs}/investigate/`; catalog size 33.
