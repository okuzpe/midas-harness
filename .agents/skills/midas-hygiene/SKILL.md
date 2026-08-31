---
name: midas-hygiene
description: "Product-repo hygiene orchestrator — dead flows, orphans, ledger/doc drift, and optional lean delete-list. Path-passes midas-sweep (scope product) + midas-lean-review. Not adapter/doctor sync. Use when the repo is dirty, before close on large diffs, or after brownfield adopt."
metadata:
  midas-argument-hint: "[all|dead-flows|code|docs|lean|report-only] [--fix]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
  midas-user-surface: primary
---
# midas-hygiene — product repo cleanup

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Surface:** `primary` — human-typed; parents (`/close-sprint` Step 0) **path-pass** this body (read + run — not Skill-tool).
> **Scope:** product code + `{product}/*` only. Never `.harness/engine` adapters, doctor, or align.

Standing **repo hygiene** (not a phase gate): find dead weight in the product tree, report, optionally fix with explicit confirm. Complements Layer C Sync (`/midas-doctor`, `/midas-align`) — those are install/adapter health, not product dead-flow.

## Does / Does not

| Does | Does not |
|---|---|
| Path-pass `midas-sweep` with scope `product` (or `code` / `docs`) | Run sweep scope `harness` or legacy `all` (includes harness) |
| Path-pass `midas-lean-review` when mode is `lean` or fat-diff `all` | Advance `stage` or pass Phase-8 alone |
| Reuse `{runs}/sweeps/sweep-NN.md` + optional `lean-NN.md` | Replace `/close-sprint`, tribunal, security, or doctor |

## Modes (AskQuestion or args)

| Mode / arg | Path-pass |
|---|---|
| `all` (default) | sweep `product`; if working-tree diff is large/fat UI-feature, also lean-review (`--scope diff`) |
| `dead-flows` / `code` | sweep `code` |
| `docs` | sweep `docs` |
| `lean` | lean-review only (`--scope diff` default) |
| `report-only` | same as chosen mode **without** `--fix` / apply |

`--fix` → forward to sweep `--fix` only after the report; lean apply only if the human asks after the delete-list.

## Procedure

1. **Read `paths.state`.** Resolve mode from args or one AskQuestion (default `all`).
2. **Sweep leg (unless mode=`lean` only):** Read and follow `<paths.engine>/skills/midas-sweep/SKILL.md` with scope **`product`** (or `code`/`docs` per mode). Never pass `harness` or `all`. Expect `harness_drift=0` in the tally for product scopes (R6).
3. **Lean leg:** When mode is `lean`, or mode is `all` and the diff is fat (many files / UI feature), path-pass `<paths.engine>/skills/midas-lean-review/SKILL.md` (optional `--freeze`).
4. **Report** combined summary; recommended next = `/close-sprint` when in an active sprint, else `/midas-status`.
5. **Optional fix:** only with explicit human OK (sweep `--fix` / lean apply). Prefer archive over hard delete.

## Pattern checklist (product)

| Pattern | Severity | Via |
|---|---|---|
| dead-flow (routes, zombie playbooks) | high | sweep `code` |
| orphan modules | medium | sweep `code` |
| ledger-drift (`features.json`, roadmap Status vs `sprints[]`) | high | sweep `docs` |
| stale-doc (OPEN answered, broken `{product}` links) | medium | sweep `docs` |
| hygiene greps (commented blocks, bare TODO) | low | sweep `code` |
| unused deps (flag only) | low | sweep `code` |
| lean (delete/stdlib/native/yagni/shrink) | varies | lean-review |

Graded at Phase 8 via `<paths.engine>/rules/hygiene.md`.

## When NOT

- Adapter / install drift → `/midas-doctor` or `/midas-align`.
- Install/setup/version confusion → `/midas-init` or `/midas-reconcile`.
- Binding conformance gate → `/close-sprint` (this skill is Step 0 input only).
- Power-user wants harness ledger vs state → path-pass `/midas-sweep harness` (internal), not this orchestrator.

## Tier & delegation

- Dispatch + report → **build** (`midas-builder`).
- Index/greps → path-pass legs use **scout** as those skills define.
- No orchestrate gate verdict.

## Exit gate

- [ ] Product scope only (no harness-drift hunt).
- [ ] Sweep and/or lean record frozen or report printed.
- [ ] No writes without explicit human confirm.
- [ ] Single next action named.
