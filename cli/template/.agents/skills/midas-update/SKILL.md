---
name: midas-update
description: "Upgrade an installed Midas project to the current engine version. Thin guide — the deterministic CLI (`npx … --update`) is the source of truth for plan, confirm, execute, verify, and rollback. Use after pulling a new engine or when /midas-doctor warns of a version mismatch."
metadata:
  midas-argument-hint: "[--dry-run]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-update — refresh via the install CLI

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Precondition:** a Midas install exists (v1 or v2). Missing → `/midas-init`. Unsure → `/midas-reconcile` or `npx github:okuzpe/midas-harness --diagnose`.

**Do not re-plan the refresh with the model.** The installer owns requirements → checks → ordered plan → confirm → execute → verify → rollback. This skill only guides the human to the right CLI and confirms the outcome.

## One command (always)

```bash
# macOS / Linux — pins latest release from GitHub, then refreshes
curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash -s -- --update --yes
```

```powershell
# Windows — same
$env:MIDAS_INSTALL_ARGS = '--update --yes'
irm https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.ps1 | iex
```

Or pinned npx:

```bash
npx github:okuzpe/midas-harness#v{VERSION} --update --yes
```

`--update` is enough on **both** v2 and 1.x (classic/compact/hub): 1.x auto-runs migrate+refresh. Explicit `--migrate` remains available for preview-only workflows.

## When NOT

- CLI already exited with **`verify: ok`** — use `/midas-status`.
- State `midas_version` already equals engine `VERSION` and doctor is clean — report already current and stop.
- Layout **conflict** (canonical + legacy markers coexist) — stop; human must resolve partial migration first.

## Procedure

1. **Orient (optional).** `npx github:okuzpe/midas-harness --diagnose` — follow `nextCli` if it is not already `--update`.
2. **Dry-run (optional).** `npx …#v{VERSION} --update --dry-run` (on 1.x this shows the migrate preview).
3. **Apply.** Ask the user to run the **One command** above (or `npx … --update --yes`).
4. **Confirm.** Success = **`verify: ok`**. Do not hand-edit engine trees, adapters, or the ownership manifest.
5. **Report.** Version bump + any migrate note the CLI printed.

## Exit gate
- [ ] User ran (or confirmed) the CLI; model did not invent a parallel copy/refresh plan.
- [ ] CLI completed with `verify: ok` (or dry-run completed with no writes).
- [ ] No user-owned product, rules, runs, MCP, or state content was edited by this skill.

## Tier & delegation
Shelling / narrating the CLI → **build** (`midas-builder`). Conflict / partial-migration judgment → **orchestrate** (`midas-orchestrator`). Respect `cost_profile`.
