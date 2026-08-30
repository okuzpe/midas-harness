---
name: midas-reconcile
user-surface: primary
description: Read-only install/orientation check — thin guide to the deterministic diagnose CLI. Detects missing install, setup pending, version behind, or wrong cwd, and prints the single next CLI or slash command. Use when npx update failed, you are unsure between install/init/adopt/update, or before /midas-status on a confused project.
user-invocable: true
disable-model-invocation: false
model: inherit
harness-tier: scout
recommended-model: claude-haiku-4-5
argument-hint: "[project-root]"
---

# midas-reconcile — which command should I run next?

> **Paths / state:** `<paths.engine>/templates/skill-state-ritual.md` (read-only) + `AGENTS.md` § Path resolution.

> **Read-only.** Never installs, never updates, never advances `stage`. Prints the **one** next step from the diagnose CLI — do not re-implement detection in the model.

Use when:
- `npx ... update` failed with "no existing Midas install"
- You are not sure whether to run `/midas-init` or `/midas-adopt`
- You might be in a subfolder instead of the project root

## Procedure

### 1. Run diagnose (source of truth)

**If `<paths.scripts>/install-diagnose.mjs` exists as a file:**

```bash
node <paths.scripts>/install-diagnose.mjs
# or machine-readable:
npx github:okuzpe/midas-harness --diagnose --json
```

Canonical v2 install: `node .harness/scripts/install-diagnose.mjs`

**If that file is missing** (engine sandbox seed, or `paths.scripts` points at repo `scripts/`):

```bash
# engine repo:
node cli/install-diagnose.mjs <product-root>
# otherwise:
npx github:okuzpe/midas-harness --diagnose
```

Do **not** assume `paths.scripts` existing as a directory means `install-diagnose.mjs` is there.

Run from the **project root** (or pass the path as the first argument).

### 2. Present the output verbatim

Statuses: `not_installed` | `unsupported_v1` | `setup_pending` | `version_behind` | `nested_or_wrong_cwd` | `partial_migrate` | `ready`

Do not invent a different command unless the script is missing (fallback below).

### 3. Fallback (script missing — manual read)

| Observation | Next step |
|-------------|-------------|
| No `.harness/engine/VERSION`, `harness/VERSION`, or `.midas/engine/VERSION` | `npx github:okuzpe/midas-harness#v{VERSION} --tools=cursor` then `/midas-init` |
| `.harness/product` or `state.yaml` without `.harness/engine/VERSION` | `/midas-init` (`partial_migrate`) — do not treat as a fresh install |
| `harness/VERSION` or `.midas/engine/VERSION` exists but canonical engine does not | Pin `create-midas@2.10.x`, migrate to `.harness/`, then upgrade to 3.x. 3.x refuses 1.x trees. |
| Engine present, `setup_complete: false` | `/midas-init` |
| v2 `midas_version` ≠ engine `VERSION` | Same: `npx …#v{VERSION} update --yes` (or `/midas-init` for the tip) |
| Parent dir has Midas, this folder does not | `cd` to parent; `/midas-status` |
| Otherwise | `/midas-status` |

## vs other commands

| Command | Role |
|---------|------|
| `/midas-reconcile` | **Which command next?** (install/setup/version/cwd) — read-only |
| `/midas-status` | **Which phase next?** (after setup is complete) |
| `/midas-init` | **Do setup / tip update** — diagnose then intake or CLI tip |
| Install CLI | Source of truth for install / update / uninstall / diagnose. `--migrate` is refused in 3.x. |

## Exit gate
- [ ] Diagnose CLI output presented (Status + Next), or fallback table used.
- [ ] Exactly **one** next command named.
- [ ] Read-only: no writes to `paths.state`, adapters, or product files.

## Tier & delegation
- **Dispatch (read-only):** `scout` → `midas-scout`.
- Never runs install/init/update itself — only points at the CLI or slash command.
- Respect `cost_profile` as intent on non-Claude hosts.
