---
name: midas-improve-loop
description: "Continuous local product improve — validate context, run tick #1, arm Cursor /loop. One slash enters automatic mode. Optional cloud draft. For ADR-009 sprint ticks use /midas-autopilot instead."
metadata:
  midas-argument-hint: "[local|cloud|stop] [interval]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-improve-loop — continuous product improve

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.
> **Runbook:** `<paths.engine>/templates/improve-loop-runbook.md.tmpl` → `{runs}/improve-loop/runbook.md`
> **Journal:** `<paths.engine>/templates/improve-loop-journal.md` → `{runs}/improve-loop/journal.md`
> **Playbook:** `<paths.engine>/templates/playbooks/improve-cycle.md` → propose `{product}/playbooks/improve-cycle.md`
> **Command map:** `docs/skills.md` § Autonomy commands (install: `<paths.engine>/docs/skills.md`).

**Renamed from `/midas-auto-pilot` (2.6.1).** Same caps; shorter responses; paths under `{runs}/improve-loop/`.

## Response shape (always)

Keep the reply **≤6 lines**. No autonomy lecture unless the user asks which command to use.

1. **Verdict** — `ready` | `ready_with_warnings` | `blocked` | `stopped` + short why
2. **Mode** — `local` (default) | `cloud` | `stop`
3. **Next** — one line (e.g. “loop armed every 30m — keep Cursor open”)
4. **Evidence** — runbook + journal paths; tick #1 result when `local`

## When NOT

- No install / no `paths.state` → `/midas-reconcile` or install (`INSTALL.md`).
- No product context at all → `/midas-init` or `/midas-adopt` first.
- Sprint checklist `tick` with ADR-009 policy/budget → `/midas-autopilot` (needs `--autonomy`).
- Phase-8 gate verdict → `/close-sprint`.
- Laptop will sleep / Cursor will quit → `cloud` mode; local `/loop` dies with the session.

## Arguments

| Arg | Meaning |
|---|---|
| *(none)* or `local` | Validate → runbook → **tick #1** → **arm `/loop`** |
| `local 15m` / `local 1h` | Same; interval default **30m** |
| `cloud` | Validate → Cursor Automation draft only |
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

### B. Default — `local` continuous

**Do not stop after printing a draft.** In the same turn:

1. Ensure `{runs}/improve-loop/`. Write/refresh `runbook.md` from the engine template.
2. Ensure `journal.md` exists (append-only). **Legacy:** if only `{runs}/auto-pilot/journal.md` exists (v2.6.0), copy rows into the new journal once and note migration in the first new row.
3. Propose playbook copy to `{product}/playbooks/improve-cycle.md` if missing.
4. **Tick #1 now** — follow runbook: orient → one candidate → branch `midas-improve/<date>-<slug>` → implement (≤~4 source files) → verify → PR (or journal `abort`). Skip inventing work if only operator tasks remain.
5. **Arm Cursor `/loop`** (default **30m**; honor `local 15m` etc.):
   - Sentinel: `AGENT_LOOP_TICK_midas_improve_loop_<name>`; `notify_on_output`; PowerShell-safe on Windows.
   - Loop prompt: *“Execute one `/midas-improve-loop` tick using `{runs}/improve-loop/runbook.md`; append `{runs}/improve-loop/journal.md`; do not merge; do not claim Phase-8.”*
   - Do not duplicate an existing loop for this project.
6. Confirm: interval, tick #1 outcome, next wake time, **Cursor must stay open**.

On later wakes: one tick only; read journal first — do not repeat an identical failed attempt.

### C. `cloud` — Cursor Automations draft only

1. Same validation + `runbook.md`.
2. Print compact table (trigger / repo / tools / branch prefix).
3. **Next:** Agents Window → Cursor `/automate` or https://cursor.com/automations — paste runbook (push remote first).
4. Do **not** arm local `/loop`.

### D. `stop`

1. Kill tracked improve-loop PID (per `/loop` stop rules).
2. Verdict `stopped`.

### E. Optional ADR-009 handoff

If `.harness/autonomy/` exists and `midas-autopilot dry-run` shows a **code** task, mention `/midas-autopilot` separately — never auto-`tick` from this skill.

## Caps (every tick)

- One improvement per tick; ~4 source files (+ tests).
- Branch prefix `midas-improve/`; **never merge**, deploy, or touch `.harness/autonomy/authz/**`.
- Never claim `gate: passed`, Phase-8 pass, or `/close-sprint` completion.
- Never execute operator release runbooks.

## Exit gate

- [ ] Verdict + evidence paths; reply ≤6 lines (no unsolicited autonomy map).
- [ ] **`local`:** tick #1 attempted **and** `/loop` armed (or hard-blocked before start).
- [ ] **`cloud`:** runbook emitted; one Next toward Automations editor.
- [ ] **`stop`:** loop killed.
- [ ] Did not auto-start ADR-009 `tick` or require `MIDAS_AUTONOMY_AUTHZ_KEY`.

## Tier & delegation

- **Dispatch:** validate + local arm + first tick → **build**.
- Scout may fetch docs during a tick; do not delegate the arming exit gate away.
- Path-pass `Delegator: yes` — `disable-model-invocation` still forbids Skill-tool / auto slash.
