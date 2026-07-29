---
name: midas-reconcile
description: "Read-only install/orientation check — detects whether Midas is missing, setup is pending, version is behind, or cwd is wrong, and prints the single next CLI or slash command. Use when npx --update failed, you are unsure between install/init/adopt/update, or before /midas-status on a confused project."
metadata:
  midas-argument-hint: "[project-root]"
  midas-disable-model-invocation: false
  midas-harness-tier: scout
  midas-model: inherit
  midas-recommended-model: claude-haiku-4-5
  midas-user-invocable: true
---
# midas-reconcile — which command should I run next?

> **Read-only.** Never installs, never updates, never advances `stage`. Prints the **one** next step.

Use when:
- `npx ... --update` failed with "no existing Midas install"
- You are not sure whether to run `/midas-init`, `/midas-adopt`, or `/midas-update`
- You might be in a subfolder instead of the project root

## Procedure

### 1. Run the diagnose script (preferred)

**If `paths.scripts` exists** (Midas already copied onto disk):

```bash
node <paths.scripts>/install-diagnose.mjs
```

Canonical v2 layout: `node .harness/scripts/install-diagnose.mjs`

**If Midas is not installed yet** (no `paths.scripts`):

```bash
npx github:okuzpe/midas-harness --diagnose
```

Run from the **project root** you care about (or pass the path as the script's first argument).

### 2. Present the output verbatim

The script prints:
- **Status** (`not_installed` | `legacy_layout` | `setup_pending` | `version_behind` | `nested_or_wrong_cwd` | `ready`)
- **Next (terminal)** — e.g. fresh `npx ...` install or `--update`
- **Next (editor)** — e.g. `/midas-init`, `/midas-status`, `/midas-update`

Do not invent a different command unless the script is missing (fallback below).

### 3. Fallback (script missing — manual read)

| Observation | Next step |
|-------------|-------------|
| No `.harness/engine/VERSION`, `harness/VERSION`, or `.midas/engine/VERSION` | `npx github:okuzpe/midas-harness#v2.0.0-rc.2 --tools=cursor` then `/midas-init` |
| `harness/VERSION` or `.midas/engine/VERSION` exists but canonical engine does not | Preview `npx ...#v2.0.0-rc.2 --migrate`; after review add `--apply` |
| Engine present, `setup_complete: false` in `paths.state` | `/midas-init` (brownfield → often `/midas-adopt`) |
| v2 `midas_version` < engine `VERSION` | `npx ... --update` or `/midas-update` |
| Parent dir has Midas, this folder does not | `cd` to parent; `/midas-status` |
| Otherwise | `/midas-status` |

## vs other commands

| Command | Role |
|---------|------|
| `/midas-reconcile` | **Which command next?** (install/setup/version/cwd) |
| `/midas-status` | **Which phase next?** (after setup is complete) |
| `/midas-init` | One-time setup (writes) |
| `/midas-adopt` | Brownfield inventory + rules (writes) |
| `/midas-update` | Engine version migration (writes) |

## Tier & cost
Scout — mechanical detection only.
