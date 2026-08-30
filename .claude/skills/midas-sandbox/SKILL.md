---
name: midas-sandbox
user-surface: engine-only
description: Engine-only sandbox — dry-runs the real, unmodified harness/skills/* against a small nested example product (sandbox/example-product/) on Cursor's composer-2.5 model (never composer-2.5-fast), with a traced decision-flow log and reviewable findings under sandbox/findings/. Use before committing a skill/rule change on midas-harness, or on demand to stress-test the pipeline. Not for product installs.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[--skill <name>] [--smoke] [--all] [--freeze]"
---

# midas-sandbox — real skill dry-run lab (engine only)

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Engine-only.** Isolation + cost: `sandbox/README.md`. Runner: `node scripts/sandbox-run.mjs`. Tally: `<paths.engine>/templates/audit-checklists.md` § Parseable tally lines.

Dispatches a **real** Midas skill (unmodified, from `harness/skills/`) against
`sandbox/example-product/`, on a Task subagent pinned to **`composer-2.5`** (**never**
`composer-2.5-fast`). Findings are **proposals**; nothing under `harness/skills/` or
`harness/rules/` is edited here.

## Does / Does not

| Does | Does not |
|---|---|
| Abort unless cwd is midas-harness engine | Run on product installs / template trees |
| Always `reset` then require `env` exit 0 before any Task | Trust a dirty `example-product/` or engine `harness/state.yaml` |
| Run the target skill **in** the composer-2.5 Task | Spawn nested Task / `midas-builder` on another model |
| Log `[SANDBOX AUTO-DECISION]` for every substituted AskQuestion | Auto-apply findings to harness source |
| Write `sandbox/findings/<date>-<mode>.md` + `MIDAS_SANDBOX_RESULT:` | Advance real engine `stage` / gates |
| Run `sandbox-run grade` (disk oracles) after the Task | Let composer grade its own homework |

## Engine guard (hard)

1. Confirm engine: `package.json` → `"name": "midas-harness"` **and** `scripts/test.mjs` exists.
2. Otherwise print: *ABORT — `/midas-sandbox` is engine-only; use `/midas-verify`* → **STOP**.

## Isolation (step 0)

Cursor Task has no cwd pin. The parent must make the fixture honest; the Task must not rediscover the engine repo.

1. **Always** `node scripts/sandbox-run.mjs reset` (wipes a dirty working copy). Then
   `node scripts/sandbox-run.mjs env` — must exit 0. Copy the `MIDAS_TRACE_ROOT:` line.
   Non-zero after a fresh reset → `isolation-bug`, **STOP** (seed is broken; do not retry).
2. Task prompt (mandatory lines):
   - First Read: `sandbox/example-product/.harness/state.yaml`. If `name` is not `sandbox-example` → **STOP** (`isolation-bug`).
   - Product root is `sandbox/example-product/` only. Never read engine `harness/state.yaml` as product state.
   - Execute the target skill **in this Task**. Do not spawn a nested Task or `midas-builder` with another model.
   - Every `node …/trace-write.mjs` subprocess gets env `MIDAS_TRACE_ROOT` = the value from `env`.
     `start-run` binds it for **that** process only; it does not export it to the Task.
3. Parent: `node scripts/sandbox-run.mjs start-run` before the Task, `finish` after.
   Then **`node scripts/sandbox-run.mjs grade --skill <name> --ledger`**. Cite
   `MIDAS_SANDBOX_ORACLE:` in findings Setup. Oracle `verdict=fail` ⇒ sandbox `verdict=fail`
   even if the Task claimed pass. Optional `--freeze` appends full `trace-inspect` output.
   `--smoke` / `--all`: grade each launched skill; if that skill has no oracle YAML, add
   `--missing skip` (isolation still fail-closes). Default `--missing fail`.
   Do not run `doctor --fix` (or otherwise edit `harness/skills` / `harness/rules`) between
   reset and grade — that is an isolation fail.

Full contract: `sandbox/README.md`.

## Modes

### `/midas-sandbox [--skill <name>]` — one skill

Step 0, then one composer-2.5 Task. If `--skill` omitted, next command from
`<paths.engine>/stage-command-table.yaml` for the **fixture** `stage`. Then findings + tally.

### `/midas-sandbox --smoke` — touched + next

Step 0 once, then the named or staged-touched skill, then the next stage-table command.
Precommit Step 0 recommends this. **Stage mismatch:** still launch; the skill's own
STOP/precondition is `fixture-limit` unless that abort is missing or misleading (`harness-gap`).
Do not rewrite fixture `stage` to fake a body run. Grade the touched skill fail-closed; grade
the next with `--missing skip` when it has no oracle.

### `/midas-sandbox --all` — pipeline batch

`AskQuestion` once to confirm cost. Step 0 once, then reuse that working copy. One continuous
trace (`start-run` once, `finish` once). Tag phases 2–4 `fixture-limit` unless a procedure bug
is obvious. Findings get `## Harness analysis`.

**Human-gate substitution:** wherever the real skill would `AskQuestion`, pick
recommended/first option and log `[SANDBOX AUTO-DECISION] <question> -> <choice> (<why>)`.

## Findings

Write `sandbox/findings/<date>-<mode>.md`: Setup · Decision-flow log · Issues found (each with
class `harness-gap` | `model-miss` | `fixture-limit` | `isolation-bug`) · Proposed improvements
(never applied). Only `harness-gap` is a `/midas-capture` / ADR candidate.

```
MIDAS_SANDBOX_RESULT: skill=<name|list> mode=single|smoke|all verdict=pass|fail auto_decisions=N isolation=ok|fail
```

`verdict=fail` if isolation failed, the oracle failed, or the skill under test crashed before its
own exit gate. `isolation=fail` is always `verdict=fail`.

## Scope note

Strongest at **procedure fidelity**. Cheap-model judgment on the toy idea is not a product
go/no-go. Say so in findings for phases 2–4.

## Tier & delegation

- **Dispatch:** `build` → `midas-builder` for the **parent** turn only (reset/env, findings, tally).
- **Sandbox Task:** always `model: "composer-2.5"` — never `composer-2.5-fast`. Run the target
  skill in-process in that Task. Not a fourth Claude tier (`<paths.engine>/rules/model-routing.md`).
- `--all` is opt-in and cost-confirmed; default is one skill; precommit prefers `--smoke`.

## When NOT

- Product-install testing → n/a (engine-only).
- Engine quality bar before commit → `/midas-precommit` (may propose this skill first).
- Adapter/doctor sync only → `/midas-doctor` / `/midas-align`.

## Exit gate

- [ ] Engine guard passed (or honest ABORT).
- [ ] `reset` then `env` exited 0; fixture `name` is `sandbox-example`.
- [ ] `grade --skill <name>` printed `MIDAS_SANDBOX_ORACLE:` with `verdict=pass` (or fail cited).
      After reset, `idea-intake` is expected **fail** until the Task advances fixture `stage`.
- [ ] Task first-Read was the fixture state; no nested Task / other-model builder.
- [ ] Every substituted `AskQuestion` is a `[SANDBOX AUTO-DECISION]` line.
- [ ] Subagent model was `composer-2.5` (cited in Setup); `MIDAS_TRACE_ROOT` passed to trace-write.
- [ ] Findings file written; no writes under `harness/skills/*` or `harness/rules/*`.
- [ ] `MIDAS_SANDBOX_RESULT:` printed; `--all` only after cost confirmation.
