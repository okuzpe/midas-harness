# Hygiene sweep sweep-14

Ran: 2026-08-07 · Tier: build · Scope: `docs`+`code` · Depth: `standard`  
Stage snapshot: `sprint_execution` / `not_started` · mode: `brownfield` · midas_version: `2.6.1`  
**Follows:** sweep-13 · triggered by `/loop` 10m tick #11

## Findings

| # | Severity | Category | Path | Note | Disposition |
|---|----------|----------|------|------|-------------|
| 1 | high | stale-doc | `docs/faq.md` | Update example pinned `#v2.2.1` while engine is **2.6.1**. | **fixed** — `#v{VERSION}` + INSTALL rebaseline link |
| 2 | medium | stale-doc | `docs/faq.md` uninstall | Kept paths described as root `product/` (v1 mental model). | **fixed** — `.harness/product|rules|runs` |
| 3 | low | hygiene | `scripts/test.mjs` version-pin list | FAQ not guarded against literal `#vX.Y.Z` drift. | **fixed** |

## Deferred

| # | Note |
|---|------|
| D1 | Orchestrate re-attest audit-02/03. |

MIDAS_SWEEP_RESULT: dead_flows=0 orphans=0 ledger_drift=0 stale_docs=0 harness_drift=0 hygiene=0 verdict=fixed

## Disposition

fixed — FAQ update/uninstall narrative aligned with INSTALL + version-pin test.
