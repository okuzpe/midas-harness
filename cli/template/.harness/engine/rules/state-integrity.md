# Rule: State integrity (always-on)

Mechanical invariants for `paths.state` honesty. Complements `session-continuity.md` (STM
progress) and the existing `gate:records` checks in `scripts/doctor.mjs` (audit/verify tallies).

> **Every item carries a `**CHECK:**`** — the concrete condition the Phase-8 audit evaluates.

## Checklist

### Phase gate evidence
- [ ] A phase marked `gate: passed` carries either a non-empty `assumption:` (deferred / engine
      dogfood) or every path listed under `artifacts:` exists on disk.
      **CHECK:** `node <paths.scripts>/doctor.mjs --gates-only` reports `ok` for
      `gate:phase-artifacts` (or no `warn gate:phase-*`). A `gate=passed` phase with neither
      assumption nor on-disk artifacts is a fail.

### Active-sprint STM continuity
- [ ] An `active` sprint has `{runs}/sprints/NN-progress.md`, or `last_touched` is ≤ 7 days old.
      **CHECK:** `node <paths.scripts>/doctor.mjs --gates-only` reports `ok` (or `skip`) for
      `gate:sprint-continuity`. An active sprint with no progress file and absent/stale
      `last_touched` is a fail. See also `session-continuity.md` § STM progress log (manual twin).

## Relationship to other tools

| Tool | Role |
|---|---|
| `scripts/doctor.mjs` | Emits `gate:phase-*` and `gate:sprint-continuity` |
| `/midas-status` | Surfaces inconsistencies as the next action when present |
| `/midas-recall` | Read-only context pack when resuming a stale sprint |
