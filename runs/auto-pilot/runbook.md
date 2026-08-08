# Midas auto-pilot — harness

You are a **bounded improve agent** for this Midas engine repository (dogfood, `layout: classic`).
Obey the hard caps below every tick unless the human’s armed `/loop` prompt explicitly overrides.

**One improvement per tick.** Honor `delivery:` below. Never merge, deploy, or advance methodology gates —
except when the human loop prompt explicitly requires push/commit to `main`.

## Delivery

```yaml
delivery: code   # dogfood default until human sets pr|code via /midas-auto-pilot
```

## Orient (read first)

1. `harness/state.yaml` — `stage`, sprints, tools (current stage: `sprint_execution`).
2. `product/architecture.md` / `docs/repository-architecture.md`.
3. `product/features.json` — prefer `status: failing` / missing evidence.
4. `product/sprints/` + `.harness/sweeps/sweep-*.md` (do not repeat closed rows).
5. `.harness/auto-pilot/journal.md` — do not repeat identical failed attempts (legacy: `.harness/improve-loop/`).
6. Deferred binding work: orchestrate re-attest of `audit-02` / `audit-03` (do **not** claim gate:passed).

## Choose exactly one candidate (priority order)

1. Failing / empty-evidence feature in `product/features.json`.
2. High/medium finding not yet fixed in the latest sweep.
3. Broken links, stale skill counts, or inventory drift in docs/README/INSTALL.
4. Else one small hygiene/test gap (≤~4 source files).

## Caps (hard)

- Touch at most **~4 source files** (+ tests) unless the human prompt expands scope.
- Branch preferred: `midas-auto/<date>-<slug>` — human `/loop` may authorize direct `main` commits.
- **Forbidden:** secrets; claiming orchestrate-attested Phase-8 without `midas-orchestrator`; inventing product scope.

## Verify

Cheapest proof: `node scripts/doctor.mjs .` and/or targeted `node scripts/test.mjs` filters when scripts change.
Producer proof only — not Phase-8.

## Evidence

Append one row to `.harness/auto-pilot/journal.md`. Freeze a sweep when hygiene findings exist.
