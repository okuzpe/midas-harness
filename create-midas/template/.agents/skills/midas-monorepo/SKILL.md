---
name: midas-monorepo
description: DEPRECATED — use /midas-init --monorepo instead. Wires nested AGENTS.md per package in a monorepo; kept as an alias for existing docs and scripts.
metadata:
  midas-argument-hint: "[--dry-run] [path/to/package ...]"
  midas-disable-model-invocation: true
  midas-harness-tier: orchestrate
  midas-model: inherit
  midas-recommended-model: claude-opus-4-8
  midas-user-invocable: true
---
# midas-monorepo — deprecated alias

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.

> **This command is deprecated.** Prefer **`/midas-init --monorepo`** (works even when `setup_complete: true`
> — it runs only Phase F monorepo wiring without repeating intake).

## Redirect

1. Tell the user: *"`/midas-monorepo` is deprecated — run `/midas-init --monorepo` instead."*
2. Execute the procedure in **`<paths.engine>/pipeline/monorepo-wiring.md`** (same DETECT → INDEX → WRITE
   flow as init Phase F).
3. Honor `--dry-run` and any user-named package paths from the original command.

## Preconditions

- Root harness initialized (`paths.state` exists).
- If no state file → `/midas-init` first.

## Exit

Same gate as `monorepo-wiring.md` § Exit gate. Next action: `/midas-status`.
