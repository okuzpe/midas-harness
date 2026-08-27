---
name: midas-init
description: "Onboarding entry — diagnose install/setup/version, tip install or pinned --update, or run one-time adaptive intake (optional --monorepo). Use when starting a project, setup_complete is false, or engine is behind."
user-invocable: true
disable-model-invocation: true
user-surface: primary
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-recommended: [context7]
argument-hint: "[--monorepo] [--dry-run]"
---

# midas-init — install / setup / update tip

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Surface:** `primary` — single human entry for onboarding. `/midas-update` is a deprecated alias here.
> **SoT for install shape:** `node <paths.scripts>/install-diagnose.mjs` (or `npx github:okuzpe/midas-harness --diagnose`). Do **not** re-implement detection in the model.

One slash: detect where the project is, then tip the install CLI, run one-time setup, or tip a pinned `--update`.

## Does / Does not

| Does | Does not |
|---|---|
| Run diagnose and branch on status | Invent a parallel install/update plan |
| Run adaptive intake when `setup_pending` | Run intake when **not installed** (no engine on disk) |
| Tip exact CLI for install or `--update` | Run `npx --update` without the human typing it |
| Honor `--monorepo` / `--dry-run` on intake path | Replace `/midas-reconcile` (read-only “which command?”) |
| Honor **`track: lite`** per `<paths.engine>/pipeline/lite.md` (Phase D Ask) | Skip `{product}/business-plan.md` on lite — write a **thin stub**; `{product}/market.md` is the optional skip |

## Procedure

### 0. Diagnose (always)

```bash
node <paths.scripts>/install-diagnose.mjs
# if scripts missing:
npx github:okuzpe/midas-harness --diagnose
```

Statuses: `not_installed` | `legacy_layout` | `setup_pending` | `version_behind` | `nested_or_wrong_cwd` | `ready`

### 1. Branch (exact)

| Status | Action |
|---|---|
| `not_installed` | Print diagnose `nextCli` (**install**, never `--update`). Say: *Install first, then re-run `/midas-init`.* **STOP** — do not start intake. |
| `setup_pending` | Continue to **§ Intake** below (init-adaptive A–F). Forward `--monorepo` / `--dry-run`. |
| `version_behind` / `legacy_layout` | Print diagnose `nextCli` (pinned `--update`). Optionally mention dry-run. **Allowed even when `setup_complete: true`.** Do not invent a copy plan. **STOP** after the tip. |
| `nested_or_wrong_cwd` | Print detail; ask human to `cd` to project root; **STOP**. |
| `ready` | Onboarding complete — *👉 Run `/midas-status`*. If args include `--monorepo`, run **Phase F only** (see init-adaptive); do not flip `setup_complete`. Otherwise **STOP**. |

### 2. Intake (`setup_pending` only)

Follow **`<paths.engine>/pipeline/init-adaptive.md`** for Phase A–F bodies
(SCAN, CLASSIFY, TRACK, PRE-FILL, SHOW+ASK, GENERATE, MONOREPO). Phase D **must** Ask `track`
(`full` \| `lite`). Lite procedure: `<paths.engine>/pipeline/lite.md`.

**Intake decision tree (within setup_pending / generate path):**
- Full intake → set `setup_complete: true`; tell user: *"Setup complete — from here, just use `/midas-status`. For later engine refresh, `/midas-init` will tip `--update`."*
- `--monorepo` alone when already complete is handled under `ready` above.

**Never write a secret to disk.** Prefer infer → SHOW → confirm for gaps.

## When NOT

- Only want a **read-only** “which command?” print → `/midas-reconcile`.
- Deep brownfield inventory mid-pipeline → `/midas-adopt` (intake may still route there).
- Adapter drift with setup already complete and versions aligned → `/midas-doctor`.
- Product dead flows → `/midas-hygiene`.

## Exit gate

- [ ] Diagnose status named; branch matched the table above.
- [ ] `not_installed` / wrong cwd → stopped without intake.
- [ ] `setup_pending` → intake completed per init-adaptive (or `--monorepo` Phase F when applicable).
- [ ] Update path → human given exact CLI; model did not shadow the installer.
- [ ] Single next action named (lite: `/plan-sprints` after Idea+Plan — never `/idea-intake` / `/market-research`).

## Tier & delegation

- Diagnose + branch judgment → **orchestrate** (`midas-orchestrator`).
- Intake produce legs → **build** / **scout** as init-adaptive defines.
- Respect `cost_profile`.
