# Hygiene sweep sweep-03

Ran: 2026-08-07 · Tier: build · Scope: `all` · Depth: `standard`  
Stage snapshot: `sprint_execution` / `not_started` · mode: `brownfield` · midas_version: `2.6.1`  
**Follows:** sweep-02 (clean) · triggered by `/loop` continuous hygiene pass

Engine dogfood repo (classic layout). Post-2.6.1 drift pass — AGENTS install template, memory model,
and comparison docs.

## Findings

| # | Severity | Category | Path | Note | Disposition |
|---|----------|----------|------|------|-------------|
| 1 | medium | harness-drift | `harness/templates/AGENTS.md.tmpl` L87–88 | Missing `/midas-lean-review`, `/midas-improve-loop` vs root `AGENTS.md`; install bundle inherited stale Safety list. | **fixed** — tmpl updated; `npm run build` |
| 2 | medium | harness-drift | `AGENTS.md` L93 | `/midas-reconcile` listed as side-effecting but skill has `disable-model-invocation: false` (read-only scout). | **fixed** — removed from Safety list |
| 3 | medium | stale-doc | `harness/research/memory-model.md` | STM/operations omitted improve-loop journal + autopilot vs shipped skills. | **fixed** — STM row + operations table |
| 4 | medium | stale-doc | `docs/muninn-comparison.md` L424 | Cited **26** skills; catalog is **32** (31 shipped + engine-only precommit). | **fixed** |
| 5 | medium | stale-doc | `docs/gstack-comparison.md` L355 | `/midas-retro` still **PROPOSED — not shipped** while sprint 02 plans it. | **fixed** — marked planned sprint 02 |
| 6 | high | ledger-drift | `product/features.json` F-002 | `/midas-retro` not on disk; sprint 02 `planned`. | **deferred** — ship via `/start-sprint 02` |
| 7 | high | ledger-drift | `product/features.json` F-003 | INSTALL.md lacks rebaseline + installer test citations. | **deferred** — ship via sprint 03 |

## Clean / verified

| Area | Result |
|------|--------|
| `node scripts/doctor.mjs .` | Adapters + gates **ok** |
| `node scripts/test.mjs` | **866** passed after fixes |
| `npm run build` | create-midas + plugin trees synced |
| `scripts/*.mjs` (25) | All wired — no orphan scripts |
| Skill trees | **32** canonical; no `midas-monorepo` |
| `docs/` + `product/` links | 0 broken relative links |
| `memory-model.md` source ↔ create-midas | Synced via `build-create` |

## Fix plan applied

1. Updated `harness/templates/AGENTS.md.tmpl` Safety list (lean-review, improve-loop; drop reconcile).
2. Updated root `AGENTS.md` (drop reconcile from side-effecting list).
3. Updated `harness/research/memory-model.md` STM + operations for improve-loop/autopilot.
4. Refreshed `docs/muninn-comparison.md` skill count; `docs/gstack-comparison.md` retro status.
5. Rebuilt install bundle (`npm run build`).

MIDAS_SWEEP_RESULT: dead_flows=0 orphans=0 ledger_drift=2 stale_docs=0 harness_drift=0 hygiene=0 verdict=fixed

## Disposition

fixed — actionable harness/doc rows closed; F-002/F-003 deferred to sprints 02–03 (ledger correctly `failing`).
