---
name: midas-auto-pilot
user-surface: primary
description: "Directed loop — next planned code task (sprint/ledger/OPEN/sweep) via /loop; freeze tick-NN then verify. Bare invoke arms after PR|code. status = journal. ADR-009 CLI via setup|dry-run|tick|resume. Never auto-tick from chat."
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[pr|code|local|cloud|stop|status|setup|dry-run|tick|resume] [interval]"
---
# midas-auto-pilot — directed loop

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.
> **Tick law (canonical):** `{runs}/auto-pilot/runbook.md` ← template `auto-pilot-runbook.md.tmpl`.
> Wakes execute the **runbook only** — not this skill from the top (no B00 / delivery Ask).
> **Artifacts:** journal `auto-pilot-journal.md`, ticks `auto-pilot-tick.md`, playbook `auto-pilot-cycle.md`.
> **ADR-009 CLI (L3):** `./sprint-checklist.md` → `.harness/autonomy/bin/midas-autopilot.mjs` — never auto-`tick` from chat.
> **Command map:** `docs/skills.md` § Autonomy commands (install: `<paths.engine>/docs/skills.md`).

## Response shape (always)

Keep the reply **≤8 lines** (≤6 when intent + delivery known). No autonomy lecture unless asked.

1. **Verdict** — `ready` | `ready_with_warnings` | `blocked` | `stopped` + short why
2. **Intent** — `directed` | `sprints` | `stop` | `status` | `unset` (delivery Ask pending)
3. **Delivery** — `pr` | `code` | `unset` | `n/a` (non-loop)
4. **Mode** — `local` | `cloud` | `stop` | `n/a`
5. **Next** — one line
6. **Evidence** — runbook / journal / tick-NN and/or CLI paths; tick result when a tick ran

## When NOT

- No install / no `paths.state` → `/midas-reconcile` or install (`INSTALL.md`).
- No planned candidate (sprint code line, failing feature, existing OPEN, existing sweep) → `blocked`; `/plan-sprints` or `/start-sprint` or `/midas-adopt`. `idea.md` alone is not enough.
- ADR-009 CLI without `.harness/autonomy/` → `--autonomy` via `/midas-init` (args `setup` / `dry-run` / `tick` / `resume` only).
- Phase-8 gate verdict → `/close-sprint`.
- Laptop will sleep / Cursor will quit → `cloud` mode; local `/loop` dies with the session.

### Host `/loop` capability

| Host | Directed loop |
|---|---|
| **Cursor** | Arm `/loop` (this skill). |
| **Claude Code, Copilot, Windsurf, Gemini** | No Cursor `/loop`. Document the tick; the human re-invokes `/midas-auto-pilot` or uses cloud Automations. |

## Arguments (short-circuit)

| Arg | Path |
|---|---|
| `pr` / `code` | Directed — set delivery, persist, continue (local default) |
| *(none)* | **B00 Directed path** (validate → delivery → tick #1 → arm `/loop`) |
| `local` / `local 15m` / `local 1h` | Directed — delivery gate → tick #1 → arm `/loop` (interval default **30m**) |
| `cloud` | Directed — delivery gate → Automations draft only; Next: **re-paste** current runbook |
| `stop` | Kill armed local loop |
| `status` | Loop journal + next candidate + idle streak — **not** ADR-009 CLI |
| `setup` / `dry-run` / `tick` / `resume` | Sprint checklist L3 — follow `./sprint-checklist.md`. `dry-run` is control-plane status |

## Procedure

### B00. Directed path (bare invoke)

No Mode Ask. Intent = `directed`. Continue A → B0 → B1 → B (or C if `cloud`).

Do **not** run a tick or arm `/loop` until delivery is known and Validate passes.

### A. Validate (directed path — read `paths.state` first)

Hard-block (`blocked`) when:

1. `paths.state` missing or unreadable, or layout is not harness-writable.
2. **No product context** under `paths.product`. Need **any one** of `architecture.md`, `features.json`, `features.md`, `project-brief.md`, `project-state.md`. `idea.md` or `open-questions.md` **alone** is not enough.
3. **No planned candidate** right now (runbook Choose steps 1–4 would be idle): no active/planned sprint **code** `- [ ]`, no failing/unevidenced feature, no existing code-fixable OPEN, no existing sweep high/medium code-fixable. Next: `/plan-sprints` or `/start-sprint`. **Do not** arm `/loop`.

Warn (`ready_with_warnings`) when `stage` ≠ `sprint_execution` but a candidate exists (still OK to run that candidate).

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

### B1. Paths + migration (one-shot, directed)

Use `paths.runs` (not a hardcoded `.harness/…` string).

1. Ensure `{runs}/auto-pilot/` and `{runs}/auto-pilot/ticks/`.
2. **Journal migrate** (never overwrite a non-empty dest journal):
   - If `{runs}/auto-pilot/journal.md` already has data rows → keep.
   - Else if `{runs}/improve-loop/journal.md` exists → copy/move into auto-pilot (note migration in first new row).
   - Else if only a pre-2.6.1 empty/legacy journal sits under auto-pilot → seed from template.
3. **Runbook:** if `{runs}/auto-pilot/runbook.md` missing, write from engine template (fill placeholders). If an `improve-loop/runbook.md` exists and dest is missing, **move as-is** first.
4. **Refresh Choose/Caps only** when the existing runbook still has fallback #5 (`one small improvement aligned`) **or** lacks `ticks/tick-` / `Result=idle`. Keep the YAML `delivery:` block and any human notes. Do **not** overwrite a customized runbook unless `--force` / human asks, except this Choose/Caps patch.
5. Propose playbook copy to `{product}/playbooks/auto-pilot-cycle.md` if missing.

### B. Default — `local` continuous (delivery known)

1. **Tick #1 now** — follow the **runbook** (not this skill’s Caps list). Freeze `tick-NN.md` before code, or journal `idle`.
2. If tick #1 is `idle` and Validate would still find no candidate → **do not** arm `/loop` (`blocked` / already stopped).
3. **Arm Cursor `/loop`** (default **30m**; honor `local 15m` etc.) only when a candidate ran or may appear later **and** this tick was not the second consecutive `idle`:
   - Kill any leftover `AGENT_LOOP_TICK_midas_improve_loop_*` for this project before arming.
   - Sentinel: `AGENT_LOOP_TICK_midas_auto_pilot_<name>`; `notify_on_output`; PowerShell-safe on Windows.
   - Loop prompt: *“Wake: execute ONE tick from `{runs}/auto-pilot/runbook.md` only — not the full `/midas-auto-pilot` skill; skip B00 and delivery Ask. Read journal + latest tick-NN first. Cite an existing source or idle. Honor `delivery:`. Append journal. Two consecutive idle → stop this loop. Do not merge. Do not claim Phase-8.”*
   - Do not duplicate an existing loop for this project.
4. Confirm: delivery, interval, tick #1 outcome, next wake time, **Cursor must stay open**.

**Later wakes (runbook only):** one tick; do not re-ask delivery or re-enter B00. If journal last two data rows are `idle` (including this tick) → kill the sentinel, verdict `stopped`, Next = `/plan-sprints` or `/start-sprint`.

### C. `cloud` — Cursor Automations draft only

1. Validate + delivery gate (B0) + runbook (B1).
2. Print compact table (trigger / repo / tools / branch prefix / delivery).
3. **Next:** Agents Window → Cursor `/automate` or https://cursor.com/automations — **re-paste the current runbook** (push remote first). Stale pasted runbooks still have the old fallback.
4. Do **not** arm local `/loop`.

### D. `stop`

1. Kill tracked auto-pilot PID (per `/loop` stop rules); also clear legacy improve-loop sentinel if present.
2. Verdict `stopped`.

### E. Sprint checklist path (CLI args only)

Follow `./sprint-checklist.md` for `setup` / `dry-run` / `tick` / `resume`. Never auto-`tick` from chat. Never require `MIDAS_AUTONOMY_AUTHZ_KEY` for everyday local setup.

### F. `status` (directed loop)

Read `{runs}/auto-pilot/journal.md` + runbook Choose sources. Print last results, idle streak, next candidate (or none). Do **not** run `midas-autopilot.mjs status`. Control-plane status is `/midas-auto-pilot dry-run`.

## Caps (every directed tick)

Follow the **runbook**. Skill-level floor (do not duplicate Choose):

- One planned improvement per tick, or idle; ~4 source files (+ tests).
- `delivery: code` — session branch `midas-auto/<date>-session`; no `gh pr create`; no `git commit` / push / merge unless the human explicitly asks in this tick; dirty allowlist = that branch’s dirty paths + `{runs}/auto-pilot/**`.
- `delivery: pr` — new `midas-auto/<date>-<slug>` each tick; open PR (do not merge); worktree clean after or abort.
- **Never** edit `main`/`master` by default.
- Never merge/deploy, touch `.harness/autonomy/authz/**`, claim `gate: passed` / Phase-8 / `/close-sprint`.
- Never execute operator release runbooks. Never invent OPEN/sweep/checklist this tick.

## Exit gate

- [ ] Verdict + evidence paths; reply ≤8 lines (≤6 when intent + delivery known).
- [ ] **Bare invoke:** directed path (no Mode Ask); delivery Ask once if unset.
- [ ] **Delivery unset (directed):** Ask once + STOP (no tick, no `/loop`, no Automations draft).
- [ ] **No candidate:** `blocked`; `/loop` not armed.
- [ ] **`local` + delivery known + candidate:** tick #1 attempted **and** `/loop` armed (or hard-blocked / idle-streak stop).
- [ ] **Two consecutive `idle`:** loop killed; Next names planning/sprint.
- [ ] **`cloud` + delivery known:** runbook emitted; Next says re-paste into Automations.
- [ ] **`stop`:** loop killed.
- [ ] **`status`:** journal + candidate; did not shell ADR-009 `status`.
- [ ] L3 args: did not auto-start ADR-009 `tick` or require `MIDAS_AUTONOMY_AUTHZ_KEY`.

## Tier & delegation

- **Dispatch:** gates + local arm + first tick + sprint narrate/setup → **build**.
- Scout may fetch docs during a tick; do not delegate the arming exit gate away.
- Path-pass `Delegator: yes` — `disable-model-invocation` still forbids Skill-tool / auto slash.
- Tick body is the runbook; this skill does not restate Choose order.
