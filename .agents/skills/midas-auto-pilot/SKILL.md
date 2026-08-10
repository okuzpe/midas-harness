---
name: midas-auto-pilot
description: "Unified autonomy guide — ask evolve vs sprint checklist (ADR-009), then PR|code delivery or CLI setup/status/tick. Arms Cursor /loop for continuous evolve. CLI midas-autopilot.mjs unchanged."
metadata:
  midas-argument-hint: "[pr|code|local|cloud|stop|setup|status|dry-run|tick|resume] [interval]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-auto-pilot — unified autonomy guide

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.
> **Evolve:** runbook/journal under `{runs}/auto-pilot/` — templates `auto-pilot-runbook.md.tmpl`, `auto-pilot-journal.md`, playbook `auto-pilot-cycle.md`.
> **Sprint checklist (L3):** `./sprint-checklist.md` → CLI `.harness/autonomy/bin/midas-autopilot.mjs` (ADR-009).
> **Command map:** `docs/skills.md` § Autonomy commands (install: `<paths.engine>/docs/skills.md`).
> **Aliases (forward here):** `/midas-auto-sprints`, `/midas-autopilot`, `/midas-improve-loop`.

## Response shape (always)

Keep the reply **≤8 lines** (≤6 when intent + delivery known). No autonomy lecture unless asked.

1. **Verdict** — `ready` | `ready_with_warnings` | `blocked` | `stopped` + short why
2. **Intent** — `evolve` | `sprints` | `stop` | `status` | `unset` (Ask pending)
3. **Delivery** — `pr` | `code` | `unset` | `n/a` (non-evolve)
4. **Mode** — `local` | `cloud` | `stop` | `n/a`
5. **Next** — one line
6. **Evidence** — runbook/journal and/or CLI paths; tick result when a tick ran

## When NOT

- No install / no `paths.state` → `/midas-reconcile` or install (`INSTALL.md`).
- No product context (evolve path) → `/midas-init` or `/midas-adopt` first.
- Sprint path without `.harness/autonomy/` → `--autonomy` via `/midas-init` (tips pinned `--update --autonomy`).
- Phase-8 gate verdict → `/close-sprint`.
- Laptop will sleep / Cursor will quit → evolve `cloud` mode; local `/loop` dies with the session.

## Arguments (short-circuit — skip Mode gate)

| Arg | Path |
|---|---|
| `pr` / `code` | Evolve — set delivery, persist, continue (local default) |
| *(none)* | **B00 Mode gate** (unless alias default — see B00) |
| `local` / `local 15m` / `local 1h` | Evolve — delivery gate → tick #1 → arm `/loop` (interval default **30m**) |
| `cloud` | Evolve — delivery gate → Automations draft only |
| `stop` | Kill armed local evolve loop |
| `setup` / `status` / `dry-run` / `tick` / `resume` | Sprint checklist — follow `./sprint-checklist.md` |

## Procedure

### B00. Mode gate (bare invoke only)

Resolve intent from (first wins): clear arg (table above) → alias default → AskQuestion.

**Alias defaults (no Ask):** bare `/midas-auto-sprints` → intent=`sprints` (then L3). Other aliases with no arg → Ask like canonical.

If **unset**, AskQuestion **once** (exact labels, this order):

1. **Continuous product evolve** — discover/fix on a schedule (`/loop` or cloud)
2. **Sprint checklist ticks** — next code task via ADR-009 CLI (needs `--autonomy`)
3. **Stop local evolve loop**
4. **Sprint status / dry-run** — read-only ADR-009 orient; if no `.harness/autonomy/` → `blocked` + point to `--autonomy` / `/midas-init`

After answer: set Intent; for (1) continue evolve (B0+); for (2) open L3 setup path; for (3) §D stop; for (4) L3 §B status/dry-run. Do **not** run evolve tick or arm `/loop` until intent is `evolve` and delivery known.

### A. Validate (evolve path — read `paths.state` first)

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

### B0. Delivery gate (evolve — before local tick or cloud draft)

Resolve `delivery` from (first wins): arg `pr`|`code` → runbook `delivery:` field → unset.

If **unset** (applies to `local` and `cloud`):

1. Ensure `{runs}/auto-pilot/` exists (migration §B1 steps 1–3 only — no tick).
2. AskQuestion **once** (exact labels):
   - **Open a PR each tick** (`pr`)
   - **Local branch only** (`code`) — no PR; no auto-commit/push
3. Verdict `blocked` — **STOP**. Do **not** run tick #1, arm `/loop`, or emit Automations draft.
4. On the next invoke (or same session after the answer): persist `delivery: pr|code` into runbook → continue.

If delivery already known → skip Ask.

### B1. Paths + migration (one-shot, evolve)

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

On later wakes: one tick only; read journal first — do not repeat an identical failed attempt; do not re-ask delivery or Mode gate.

### C. `cloud` — Cursor Automations draft only

1. Validate + delivery gate (B0) + runbook (B1).
2. Print compact table (trigger / repo / tools / branch prefix / delivery).
3. **Next:** Agents Window → Cursor `/automate` or https://cursor.com/automations — paste runbook (push remote first).
4. Do **not** arm local `/loop`.

### D. `stop`

1. Kill tracked auto-pilot PID (per `/loop` stop rules); also clear legacy improve-loop sentinel if present.
2. Verdict `stopped`.

### E. Sprint checklist path

Follow `./sprint-checklist.md`. Never auto-`tick` from chat. Never require `MIDAS_AUTONOMY_AUTHZ_KEY` for everyday local setup.

## Caps (every evolve tick)

- One improvement per tick; ~4 source files (+ tests).
- Branch prefix `midas-auto/`; **never** edit `main`/`master` by default.
- **Dirty tree:** `git status --porcelain` — abort if dirty paths fall outside the tick allowlist (files touched this tick + `{runs}/auto-pilot/**`).
- **`delivery: code`:** no `gh pr create`; no `git commit` / push / merge unless the human explicitly asks in this tick; evidence = diff + verify + journal.
- **`delivery: pr`:** open PR (do not merge); if PR tools unavailable, push branch and leave compare URL in journal.
- Never merge/deploy, touch `.harness/autonomy/authz/**`, claim `gate: passed` / Phase-8 / `/close-sprint`.
- Never execute operator release runbooks.
- Orient may read latest `{runs}/sweeps/sweep-*.md`; optional lean path-pass (`midas-lean-review`) on fat shrink diffs — **no** Skill-tool slash invoke.

## Exit gate

- [ ] Verdict + evidence paths; reply ≤8 lines (≤6 when intent + delivery known).
- [ ] **Bare invoke / Mode unset:** Ask once (B00) before evolve tick or sprint CLI effects (except alias default for bare `/midas-auto-sprints`).
- [ ] **Delivery unset (evolve):** Ask once + STOP (no tick, no `/loop`, no Automations draft).
- [ ] **`local` + delivery known:** tick #1 attempted **and** `/loop` armed (or hard-blocked before start).
- [ ] **`cloud` + delivery known:** runbook emitted; one Next toward Automations editor.
- [ ] **`stop`:** loop killed.
- [ ] Sprint path: L3 exit gate; did not auto-start ADR-009 `tick` or require `MIDAS_AUTONOMY_AUTHZ_KEY`.

## Tier & delegation

- **Dispatch:** Mode/delivery gates + local arm + first evolve tick + sprint narrate/setup → **build**.
- Scout may fetch docs during an evolve tick; do not delegate the arming exit gate away.
- Path-pass `Delegator: yes` — `disable-model-invocation` still forbids Skill-tool / auto slash.
