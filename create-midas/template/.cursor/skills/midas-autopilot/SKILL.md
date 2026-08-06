---
name: midas-autopilot
description: "Bounded sprint autopilot — thin guide to midas-autopilot setup/status/dry-run/tick. Use when enabling ADR-009 autonomy, checking blockers, or scheduling one task per tick. Does not auto-run tick or cursor-cloud from chat."
metadata:
  midas-argument-hint: "[setup|status|dry-run]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-autopilot — bounded autonomy (guide only)

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.
> **ADR-009:** `.harness/autonomy/README.md` + `security.md` (optional capability).
> **Runtime:** `.harness/autonomy/bin/midas-autopilot.mjs` — **only** this CLI may start `execute-next-sprint-task`.

**Do not run `tick` or `cursor-cloud` from chat without explicit human confirmation.** This skill orients, runs read-only checks, and shells `setup` when the user asks.

## Response shape (always)

Keep the reply short. Prefer this structure:

1. **Verdict** — one line (`ready` / `blocked` + why)
2. **Next** — quote `dry_run.recommendation` (or `next_steps[0]`) — **one** command, not an options wall
3. **Queued task** — only if `next.task` is a code task (`would_effect` path)

Never invent Option A/B/C lists when `recommendation.command` already exists.

## When NOT

- No `.harness/autonomy/` → installer first: `npx … --update --autonomy` (see `/midas-update`).
- `stage` ≠ `sprint_execution` → finish phase gates or `/start-sprint` first.
- Blocker `no_code_task` → open items are operator/manual (release, publish, smoke). Autopilot skips them; finish ops by hand or activate a **code** sprint.
- User wants a chat loop only → Cursor `/loop` or manual Phase 7 loop; not a substitute for this control plane.

## Procedure

### A. First-time / renew authz

```bash
export MIDAS_AUTONOMY_AUTHZ_KEY="<local-secret>"
node .harness/autonomy/bin/midas-autopilot.mjs setup --actor=<you> --hours=24
```

`setup` enables `mode: bounded`, grants a **time-boxed multi-use** authz (until `--hours`), then `dry-run`.
Pass `--single-use` only when you want one tick per grant.

### B. Check blockers (read-only)

```bash
node .harness/autonomy/bin/midas-autopilot.mjs status
node .harness/autonomy/bin/midas-autopilot.mjs dry-run
```

Summarize `would_effect`, `blockers`, and **`recommendation`** (single next command). If `operator_pending` is set, list those titles as human work — do not propose ticking them.

### C. One task (human-confirmed only)

Only when `would_effect: true` and `next.task` is present:

```bash
node .harness/autonomy/bin/midas-autopilot.mjs tick --runner=fake
# or: --runner=cursor-cloud   # needs CURSOR_API_KEY
```

### D. Resume after pause

```bash
node .harness/autonomy/bin/midas-autopilot.mjs resume --runner=fake
```

## Task selection

- Autopilot takes the first unchecked `- [ ]` **code** line.
- Skips lines marked `[manual]` / `[operator]` / `[human]` / `[ops]` / `[no-auto]`, plus common release-runbook heuristics (`Wait for Actions`, `Publish` draft, smoke on install, …).
- Tag intentional human work with `[operator]` when heuristics might miss.

## Brownfield notes

- Sprint file: `{product}/sprints/NN-*.md` **or** `{product}/planning/sprint-NN-*.md`
- Runnable sprint: `status: active` or latest `planned` in `state.yaml`
- Repo for authz: `git remote origin` when not passed explicitly

## Exit gate

- [ ] User ran (or confirmed) the CLI; model did not invent parallel autonomy logic.
- [ ] Reply named **one** next command from `recommendation` (no A/B/C option walls).
- [ ] `tick` / `cursor-cloud` only named after explicit human OK and `would_effect: true`.

## Tier & delegation

- **Dispatch:** narrate + shell `setup`/`status`/`dry-run` → **build** (`midas-builder`).
- **Never** delegate `tick` to chat auto-invocation; scheduler or human runs the CLI.
- Policy/authz/journal changes outside `setup` remain human-owned files.
