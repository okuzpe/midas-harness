---
name: midas-sandbox
user-surface: primary
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
| Require `sandbox-run env` exit 0 before any Task | Read engine `harness/state.yaml` as product state |
| Run skills on `composer-2.5` (never `-fast`) | Auto-apply findings to harness source |
| Log `[SANDBOX AUTO-DECISION]` for every substituted AskQuestion | Touch engine contributor `harness/state.yaml` |
| Write `sandbox/findings/<date>-<mode>.md` + `MIDAS_SANDBOX_RESULT:` | Advance real engine `stage` / gates |

## Engine guard (hard)

1. Confirm engine: `package.json` → `"name": "midas-harness"` **and** `scripts/test.mjs` exists.
2. Otherwise print: *ABORT — `/midas-sandbox` is engine-only; use `/midas-verify`* → **STOP**.

## Isolation (step 0)

1. If `sandbox/example-product/.harness/state.yaml` is missing:
   `node scripts/sandbox-run.mjs reset`.
2. `node scripts/sandbox-run.mjs env` — must exit 0. Non-zero → `isolation-bug`, **STOP**.
3. Task prompt: first Read is `sandbox/example-product/.harness/state.yaml`. If `name` is not
   `sandbox-example` → **STOP** (`isolation-bug`). Full contract: `sandbox/README.md`.

Trace: `node scripts/sandbox-run.mjs start-run` before the Task, `finish` after (sets
`MIDAS_TRACE_ROOT` to the working copy). Optional `--freeze` appends full `trace-inspect` output.

## Modes

### `/midas-sandbox [--skill <name>]` — one skill

If `--skill` omitted, next command from `<paths.engine>/stage-command-table.yaml` for the
**fixture** `stage`. One composer-2.5 Task. Then findings + tally.

### `/midas-sandbox --smoke` — touched + next

Run the named or staged-touched skill, then the next stage-table command. Precommit Step 0
recommends this. **Stage mismatch:** still launch; the skill's own STOP/precondition is
`fixture-limit` unless that abort is missing or misleading (`harness-gap`). Do not rewrite
fixture `stage` to fake a body run.

### `/midas-sandbox --all` — pipeline batch

`AskQuestion` once to confirm cost. Reuse the same working copy (reset first). One continuous
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

`verdict=fail` if isolation failed or the skill under test crashed before its own exit gate.
`isolation=fail` is always `verdict=fail`.

## Scope note

Strongest at **procedure fidelity**. Cheap-model judgment on the toy idea is not a product
go/no-go. Say so in findings for phases 2–4.

## Tier & delegation

- **Dispatch:** `build` → `midas-builder` for the parent turn (env/reset, findings, tally).
- **Sandbox Task:** always `model: "composer-2.5"` — never `composer-2.5-fast`. Cursor-only pin;
  not a fourth Claude tier (`<paths.engine>/rules/model-routing.md`).
- `--all` is opt-in and cost-confirmed; default is one skill; precommit prefers `--smoke`.

## When NOT

- Product-install testing → n/a (engine-only).
- Engine quality bar before commit → `/midas-precommit` (may propose this skill first).
- Adapter/doctor sync only → `/midas-doctor` / `/midas-align`.

## Exit gate

- [ ] Engine guard passed (or honest ABORT).
- [ ] `sandbox-run env` exited 0; fixture `name` is `sandbox-example`.
- [ ] Every substituted `AskQuestion` is a `[SANDBOX AUTO-DECISION]` line.
- [ ] Subagent model was `composer-2.5` (cited in Setup).
- [ ] Findings file written; no writes under `harness/skills/*` or `harness/rules/*`.
- [ ] `MIDAS_SANDBOX_RESULT:` printed; `--all` only after cost confirmation.
