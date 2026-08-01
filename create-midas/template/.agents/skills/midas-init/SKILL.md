---
name: midas-init
description: "One-time adaptive setup — scan repo, classify maturity, pre-fill artifacts, ask gap-only questions, place at the right phase; optional --monorepo. Use when the user explicitly runs /midas-init on a fresh or incomplete install."
metadata:
  midas-argument-hint: "[--monorepo] [--dry-run]"
  midas-disable-model-invocation: true
  midas-harness-tier: orchestrate
  midas-mcp-recommended: "[context7]"
  midas-model: inherit
  midas-recommended-model: claude-opus-4-8
  midas-user-invocable: true
---
# midas-init — adaptive intake (one-time setup)

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> Read **`paths.state`** first. Wrong precondition → report and stop.

## Does / Does not

| Does | Does not |
|---|---|
| Scan, classify, pre-fill, place at correct phase | Run when `setup_complete: true` (except `--monorepo`) |
| One batched `AskUserQuestion` for genuine gaps | Silently bake inferred values — always infer → SHOW → confirm |
| Set `setup_complete: true` on full intake | Overwrite content outside `<!-- midas:begin -->` … `<!-- midas:end -->` |

**Decision tree:**
- `setup_complete: true` + `--monorepo` → **Phase F only**; do not flip `setup_complete`; point at `/midas-status`.
- `setup_complete: true` without `--monorepo` → **STOP**; point at `/midas-status`.
- Otherwise → full intake; set `setup_complete: true`; tell user: *"Setup complete — from here, just use `/midas-status`; you won't need `/midas-init` again (except `--monorepo` wiring)."*

**Flow:** SCAN → CLASSIFY → TRACK → PRE-FILL → SHOW + ASK → GENERATE → [MONOREPO] → `setup_complete: true`. **Never write a secret to disk.**

## Full procedure

Follow **`<paths.engine>/pipeline/init-adaptive.md`** for the complete Phase A–F bodies
(SCAN, CLASSIFY, TRACK, PRE-FILL, SHOW+ASK, GENERATE, MONOREPO).

---

## Exit

Confirm files written, secret command if any, maturity chosen, **single next action** from table.
Add: *"👉 Optional: `/midas-recall phase` to orient."* Then `/midas-status` from here on.

## Tier & cost
Scan → **scout**. Classification + adoption → **orchestrate**. Pre-fill drafts → **build**.
