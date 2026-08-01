---
name: midas-monorepo
description: DEPRECATED — use /midas-init --monorepo instead. Alias that runs monorepo wiring (nested AGENTS.md per package). Use only when an old doc/script still invokes /midas-monorepo.
metadata:
  midas-argument-hint: "[--dry-run] [path/to/package ...]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-monorepo — deprecated alias

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).

> **This command is deprecated.** Prefer **`/midas-init --monorepo`** (works even when `setup_complete: true`
> — it runs only Phase F monorepo wiring without repeating intake). Tier is **build** because this alias
> only redirects to mechanical DETECT → INDEX → WRITE wiring (no orchestrate judgment).

## Redirect

1. Tell the user: *"`/midas-monorepo` is deprecated — run `/midas-init --monorepo` instead."*
2. Execute the procedure in **`<paths.engine>/pipeline/monorepo-wiring.md`** (same DETECT → INDEX → WRITE
   flow as init Phase F). Respect brownfield dry-run / diff-confirm in that playbook.
3. Honor `--dry-run` and any user-named package paths from the original command.

## Preconditions

- Root harness initialized (`paths.state` exists).
- If no state file → `/midas-init` first.

## Exit gate (alias complete)

- [ ] User was told to prefer `/midas-init --monorepo`.
- [ ] `monorepo-wiring.md` § Exit gate criteria are satisfied (or `--dry-run` showed the plan with no writes).
- [ ] Next action named: `/midas-status`.
