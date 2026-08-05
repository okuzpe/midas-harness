---
name: midas-precommit
description: "Engine-only precommit quality bar — scores architecture, security, agentic design, tests, reliability, docs, simplicity, DX, code quality, maintainability, change propagation, and methodology; requires overall >= 80 before commit. Use before committing on midas-harness. Not for product installs."
metadata:
  midas-argument-hint: "[--quick|--full] [--freeze]"
  midas-disable-model-invocation: true
  midas-harness-tier: orchestrate
  midas-model: inherit
  midas-recommended-model: claude-opus-4-8
  midas-user-invocable: true
---
# midas-precommit — engine quality bar (≥ 80)

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Engine-only.** Rubric: `docs/precommit-gate.md`. Mechanical floor: `node scripts/precommit-eval.mjs`.

Standing **pre-commit gate for the midas-harness engine repo**. Scores the same harness-fitness
dimensions used in full audits. **Overall must be ≥ 80** or the verdict is fail — do not commit.

## Does / Does not

| Does | Does not |
|---|---|
| Abort unless cwd is midas-harness engine | Run on product installs / template trees |
| Run mechanical floor + score 12 dimensions 1–100 | Advance `stage` or pass lifecycle gates |
| Require overall ≥ 80 to `verdict=pass` | Replace `/midas-align`, `/midas-doctor`, or CI |
| Optional freeze under `.harness/precommits/` | Ship this skill to `create-midas` / plugin |

## Engine guard (hard)

1. Confirm engine: `package.json` → `"name": "midas-harness"` **and** `scripts/test.mjs` exists.
2. Otherwise print: *ABORT — `/midas-precommit` is engine-only; use `/midas-align`* → **STOP**.

## Procedure

### 1. Mechanical floor

```bash
node scripts/precommit-eval.mjs --json
```

If exit ≠ 0 or `mechanical_ok` is false → `verdict=fail`, list `hard_fails`, **STOP** (fix before re-scoring).

### 2. Score dimensions

Read `docs/precommit-gate.md`. For each dimension id, assign **1–100** with one evidence path.

| Mode | How |
|---|---|
| `--quick` (default) | Scout the dirty tree (`git status` / `git diff`); one scoring pass |
| `--full` | Fan out cheap subagents (composer / scout) by cluster, then synthesize |

Clusters for `--full`: architecture+propagation · security · agentic · testing+reliability · docs+DX+simplicity · code+maintainability · methodology.

### 3. Aggregate

- `overall` = mean of the 12 scores, rounded to nearest integer.
- `dims_below_80` = count of dimensions with score &lt; 80 (informational; pass is on **overall**).
- Critical security finding → force `verdict=fail`.

### 4. Report (required)

```markdown
# midas-precommit — <YYYY-MM-DD> — mode: <quick|full>

## Mechanical
- precommit-eval → <ok|fail>

## Scorecard
| Dimension | Score | Evidence |
|-----------|------:|----------|
| architecture | N | path |
| … | … | … |

## Verdict
MIDAS_PRECOMMIT_RESULT: overall=N threshold=80 verdict=pass|fail mechanical=ok|fail dims_below_80=N

## Blockers (if fail)
- …

## Next
- pass → safe to commit (still run `npm run align` when mirrors/rules changed)
- fail → fix blockers; re-run `/midas-precommit`
```

### 5. `--freeze` (optional)

Write `.harness/precommits/precommit-NN.md` (NN monotonic). Include the full scorecard + tally line.
Do not set any lifecycle `gate: passed`.

## Tier & delegation

- **Dispatch + verdict:** `orchestrate` → `midas-orchestrator` (binding pass/fail).
- **Diff / file extraction / `--full` fan-out legs:** `scout` → `midas-scout`.
- **Interpreting test/doctor output:** `build` → `midas-builder`.
- Respect `cost_profile`; prefer `--quick` unless the user asks `--full`.

## When NOT

- Product install / example project → `/midas-align` or `/midas-doctor`.
- Adapter-only drift → `/midas-doctor`.
- Propagation matrix after engine edits → `/midas-align` (run **before** or **with** this gate).
- Security deep dive only → `/midas-security-audit` (still may feed the security dimension).

## Exit gate

- [ ] Engine guard passed (or honest ABORT).
- [ ] `precommit-eval` run; mechanical failures block.
- [ ] All 12 dimensions scored with evidence.
- [ ] `MIDAS_PRECOMMIT_RESULT` printed; `verdict=pass` only if overall ≥ 80 and mechanical ok.
- [ ] On fail, user told not to commit and given concrete blockers.
