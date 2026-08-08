---
name: midas-auto-pilot
description: "Continuous local product evolve — ask PR|code delivery, then tick + arm Cursor /loop. Optional cloud draft. For ADR-009 sprint checklist ticks use /midas-auto-sprints (CLI midas-autopilot.mjs)."
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[pr|code|local|cloud|stop] [interval]"
---

# midas-auto-pilot — continuous product evolve

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.
> **Runbook:** `<paths.engine>/templates/auto-pilot-runbook.md.tmpl` → `{runs}/auto-pilot/runbook.md`
> **Journal:** `<paths.engine>/templates/auto-pilot-journal.md` → `{runs}/auto-pilot/journal.md`
> **Playbook:** `<paths.engine>/templates/playbooks/auto-pilot-cycle.md` → propose `{product}/playbooks/auto-pilot-cycle.md`
> **Command map:** `docs/skills.md` § Autonomy commands (install: `<paths.engine>/docs/skills.md`).

**Not** `/midas-auto-sprints` (sprint checklist) and **not** the CLI `midas-autopilot.mjs`.
Former names: `/midas-improve-loop` (2.6.1–2.8.1), `/midas-auto-pilot` (≤2.6.0, reclaimed 2.8.2).

## Response shape (always)

Keep the reply **≤8 lines** (≤6 after delivery is known). No autonomy lecture unless asked.

1. **Verdict** — `ready` | `ready_with_warnings` | `blocked` | `stopped` + short why
2. **Delivery** — `pr` | `code` | `unset` (when Ask pending)
3. **Mode** — `local` (default) | `cloud` | `stop`
4. **Next** — one line
5. **Evidence** — runbook + journal paths; tick result when a tick ran

## When NOT

- No install / no `paths.state` → `/midas-reconcile` or install (`INSTALL.md`).
- No product context at all → `/midas-init` or `/midas-adopt` first.
- Sprint checklist `tick` with ADR-009 policy/budget → `/midas-auto-sprints` (needs `--autonomy`; CLI `midas-autopilot.mjs`).
- Phase-8 gate verdict → `/close-sprint`.
- Laptop will sleep / Cursor will quit → `cloud` mode; local `/loop` dies with the session.

## Arguments

| Arg | Meaning |
|---|---|
| `pr` / `code` | Set delivery, persist to runbook, then continue (local default) |
| *(none)* or `local` | Validate → **B0 delivery gate** → (if known) tick #1 → arm `/loop` |
| `local 15m` / `local 1h` | Same; interval default **30m** |
| `cloud` | Validate → delivery gate → Cursor Automation draft only |
| `stop` | Kill armed local loop |

## Procedure

### A. Validate (read `paths.state` first)

Hard-block (`blocked`) only when:

1. `paths.state` missing or unreadable, or layout is not harness-writable.
2. **No product context** under `paths.product`. Accept **any one** of:
   - `idea.md`, `architecture.md`, `features.json` (greenfield)
   - `features.md`, `project-brief.md`, `project-state.md` (brownfield)
   - `open-questions.md` alone is **not** enough

Warn (`ready_with_warnings`) when:

- `stage` ≠ `sprint_execution` (still OK to improve).
- Active/planned sprint looks operator-only — each tick picks a **code** improvement.

Record `name`, `stage`, `paths.product`, `paths.runs`.

### B0. Delivery gate (before local tick or cloud draft)

Resolve `delivery` from (first wins): arg `pr`|`code` → runbook `delivery:` field → unset.

If **unset** (applies to `local` and `cloud`):

1. Ensure `{runs}/auto-pilot/` exists (migration §B1 steps 1–3 only — no tick).
2. AskQuestion **once** (exact labels):
   - **Open a PR each tick** (`pr`)
   - **Local branch only** (`code`) — no PR; no auto-commit/push
3. Verdict `blocked` — **STOP**. Do **not** run tick #1, arm `/loop`, or emit Automations draft.
4. On the next invoke (or same session after the answer): persist `delivery: pr|code` into runbook → continue.

If delivery already known → skip Ask.

### B1. Paths + migration (one-shot)

Use `paths.runs` (not a hardcoded `.harness/…` string).

1. Ensure `{runs}/auto-pilot/`.
2. **Journal migrate** (never overwrite a non-empty dest journal):
   - If `{runs}/auto-pilot/journal.md` already has data rows → keep.
   - Else if `{runs}/improve-loop/journal.md` exists → copy/move into auto-pilot (note migration in first new row).
   - Else if only a pre-2.6.1 empty/legacy journal sits under auto-pilot → seed from template.
3. **Runbook:** if `{runs}/auto-pilot/runbook.md` missing, write from engine template (fill placeholders). If an `improve-loop/runbook.md` exists and dest is missing, **move as-is** first. Do **not** refresh/overwrite a non-template customized runbook unless `--force` / human asks.
4. Propose playbook copy to `{product}/playbooks/auto-pilot-cycle.md` if missing.

### B. Default — `local` continuous (delivery known)

1. **Tick #1 now** — follow runbook (delivery-aware Evidence). Caps: ≤~4 source files; branch `midas-auto/<date>-<slug>`.
2. **Arm Cursor `/loop`** (default **30m**; honor `local 15m` etc.):
   - Kill any leftover `AGENT_LOOP_TICK_midas_improve_loop_*` for this project before arming.
   - Sentinel: `AGENT_LOOP_TICK_midas_auto_pilot_<name>`; `notify_on_output`; PowerShell-safe on Windows.
   - Loop prompt: *“Execute one `/midas-auto-pilot` tick using `{runs}/auto-pilot/runbook.md` (honor `delivery:`); append `{runs}/auto-pilot/journal.md`; do not merge; do not claim Phase-8.”*
   - Do not duplicate an existing loop for this project.
3. Confirm: delivery, interval, tick #1 outcome, next wake time, **Cursor must stay open**.

On later wakes: one tick only; read journal first — do not repeat an identical failed attempt; do not re-ask delivery.

### C. `cloud` — Cursor Automations draft only

1. Validate + delivery gate (B0) + runbook (B1).
2. Print compact table (trigger / repo / tools / branch prefix / delivery).
3. **Next:** Agents Window → Cursor `/automate` or https://cursor.com/automations — paste runbook (push remote first).
4. Do **not** arm local `/loop`.

### D. `stop`

1. Kill tracked auto-pilot PID (per `/loop` stop rules); also clear legacy improve-loop sentinel if present.
2. Verdict `stopped`.

### E. Optional ADR-009 handoff

If `.harness/autonomy/` exists and `midas-autopilot dry-run` shows a **code** task, mention `/midas-auto-sprints` separately — never auto-`tick` from this skill.

## Caps (every tick)

- One improvement per tick; ~4 source files (+ tests).
- Branch prefix `midas-auto/`; **never** edit `main`/`master` by default.
- **Dirty tree:** `git status --porcelain` — abort if dirty paths fall outside the tick allowlist (files touched this tick + `{runs}/auto-pilot/**`).
- **`delivery: code`:** no `gh pr create`; no `git commit` / push / merge unless the human explicitly asks in this tick; evidence = diff + verify + journal.
- **`delivery: pr`:** open PR (do not merge); if PR tools unavailable, push branch and leave compare URL in journal.
- Never merge/deploy, touch `.harness/autonomy/authz/**`, claim `gate: passed` / Phase-8 / `/close-sprint`.
- Never execute operator release runbooks.
- Orient may read latest `{runs}/sweeps/sweep-*.md`; optional lean path-pass (`midas-lean-review`) on fat shrink diffs — **no** Skill-tool slash invoke.

## Exit gate

- [ ] Verdict + evidence paths; reply ≤8 lines (≤6 when delivery already known).
- [ ] **Delivery unset:** Ask once + STOP (no tick, no `/loop`, no Automations draft).
- [ ] **`local` + delivery known:** tick #1 attempted **and** `/loop` armed (or hard-blocked before start).
- [ ] **`cloud` + delivery known:** runbook emitted; one Next toward Automations editor.
- [ ] **`stop`:** loop killed.
- [ ] Did not auto-start ADR-009 `tick` or require `MIDAS_AUTONOMY_AUTHZ_KEY`.

## Tier & delegation

- **Dispatch:** validate + delivery gate + local arm + first tick → **build**.
- Scout may fetch docs during a tick; do not delegate the arming exit gate away.
- Path-pass `Delegator: yes` — `disable-model-invocation` still forbids Skill-tool / auto slash.
