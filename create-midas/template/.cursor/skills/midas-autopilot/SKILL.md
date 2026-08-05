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

## When NOT

- No `.harness/autonomy/` → installer first: `npx … --update --autonomy` (see `/midas-update`).
- `stage` ≠ `sprint_execution` → finish phase gates or `/start-sprint` first.
- Sprint tasks are operator-only (release, merge, deploy) → autopilot targets **code** checklist items.
- User wants a chat loop only → Cursor `/loop` or manual Phase 7 loop; not a substitute for this control plane.

## Procedure

### A. First-time setup (default)

Ask the user to set a local HMAC key (never commit):

```bash
export MIDAS_AUTONOMY_AUTHZ_KEY="<local-secret>"
node .harness/autonomy/bin/midas-autopilot.mjs setup --actor=<you> --hours=24
```

`setup` will: enable `mode: bounded` in policy (if needed) → grant commit/push authz → `dry-run`.

If capability is missing, `setup` prints the `npx … --autonomy` command.

### B. Check blockers (read-only)

```bash
node .harness/autonomy/bin/midas-autopilot.mjs status
node .harness/autonomy/bin/midas-autopilot.mjs dry-run
```

Summarize `would_effect`, `blockers`, and `next` (sprint, task, branch) in plain language.

### C. One task (human-confirmed only)

After `dry-run` shows `would_effect: true`, the **human** runs:

```bash
# Pilot / CI without tokens:
node .harness/autonomy/bin/midas-autopilot.mjs tick --runner=fake

# Production (requires CURSOR_API_KEY):
node .harness/autonomy/bin/midas-autopilot.mjs tick --runner=cursor-cloud
```

Repeat tick or schedule `.harness/autonomy/workflows/autonomy-tick.yml` in GitHub Actions.

### D. Resume after pause

```bash
node .harness/autonomy/bin/midas-autopilot.mjs resume --runner=fake
```

## Brownfield notes

- Sprint file: `{product}/sprints/NN-*.md` **or** `{product}/planning/sprint-NN-*.md`
- Runnable sprint: `status: active` or latest `planned` in `state.yaml`
- Repo for authz: `git remote origin` when not passed explicitly

## Exit gate

- [ ] User ran (or confirmed) the CLI; model did not invent parallel autonomy logic.
- [ ] `tick` / `cursor-cloud` only named after explicit human OK.
- [ ] Blockers explained with the **next single command** (setup, authz, `/start-sprint`, or tick).

## Tier & delegation

- **Dispatch:** narrate + shell `setup`/`status`/`dry-run` → **build** (`midas-builder`).
- **Never** delegate `tick` to chat auto-invocation; scheduler or human runs the CLI.
- Policy/authz/journal changes outside `setup` remain human-owned files.
