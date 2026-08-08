---
name: midas-update
description: Upgrade an installed Midas project to the current engine version. Thin guide — the deterministic CLI (`npx … --update`) is the source of truth for plan, confirm, execute, verify, and rollback. Use after pulling a new engine or when /midas-doctor warns of a version mismatch.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[--dry-run]"
---

# midas-update — refresh via the install CLI

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Precondition:** `paths.state` exists. Missing → `/midas-init`. Unsure install vs update → `/midas-reconcile` or `npx github:okuzpe/midas-harness --diagnose`.

**Do not re-plan the refresh with the model.** The installer owns requirements → checks → ordered plan → confirm → execute → verify → rollback. This skill only guides the human to the right CLI and confirms the outcome.

## When NOT

- `npx github:okuzpe/midas-harness#v{VERSION} --update` already exited with **`verify: ok`** — use `/midas-status`.
- State `midas_version` already equals engine `VERSION` — report already current and stop.
- Classic / compact / hub 1.x layout — stop; use `npx …#v{VERSION} --migrate` (preview) then `--migrate --apply` (never `--update`).

## Procedure

1. **Orient (optional).** `npx github:okuzpe/midas-harness --diagnose` (or `node <paths.scripts>/install-diagnose.mjs`) — if status is not `version_behind` / ready-with-mismatch, follow that output instead.
2. **Dry-run (recommended).**
   ```bash
   npx github:okuzpe/midas-harness#v{VERSION} --update --dry-run
   ```
   Substitute `{VERSION}` from `INSTALL.md` / the target engine tag. Writes nothing; prints the lifecycle plan.
3. **Apply.** Ask the user to run (or, with explicit confirmation, shell):
   ```bash
   npx github:okuzpe/midas-harness#v{VERSION} --update
   ```
   CI / non-TTY: add `--yes`. Machine-readable: add `--json`. Optional `--tools=…` rewrites `state.tools` and prunes orphan host mirrors.
4. **Confirm result.** Success means the CLI printed **`verify: ok`** (or `--json` with `"ok": true`). Do not hand-edit engine trees, adapters, or the ownership manifest.
5. **Report.** Summarize CLI exit, version bump, and any follow-ups from `paths.engine/migrations/` notes if the CLI mentioned them.

## Exit gate
- [ ] User ran (or confirmed) the CLI; model did not invent a parallel copy/refresh plan.
- [ ] CLI completed with `verify: ok` (or dry-run completed with no writes).
- [ ] No user-owned product, rules, runs, MCP, or state content was edited by this skill.

## Tier & delegation
Shelling / narrating the CLI → **build** (`midas-builder`). Non-trivial migration judgment (legacy layout, conflict abort) → **orchestrate** (`midas-orchestrator`). Respect `cost_profile`.
