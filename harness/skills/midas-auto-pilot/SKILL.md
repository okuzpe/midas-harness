---
name: midas-auto-pilot
description: Start continuous local product-aligned improve cycles (discover → one fix → verify → PR) by arming Cursor /loop — one slash enters automatic mode. Optional cloud draft for Cursor Automations. Distinct from ADR-009 /midas-autopilot CLI ticks.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[local|cloud|stop] [interval]"
---

# midas-auto-pilot — continuous improve (local-first)

> **Disambiguation (always say first):**
> - **`/midas-auto-pilot`** (this skill) — continuous **local** improve; one slash → automatic mode.
> - **`/midas-autopilot`** — ADR-009 **CLI** policy/budget/`tick` (sprint checklist actuator).
> - Cursor **`/automate`** — Cloud Automations editor (Agents Window / cursor.com).
> - Cursor **`/loop`** — local wake mechanism this skill **arms** (do not tell the user to invent a second loop).

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.
> **Runbook:** `<paths.engine>/templates/auto-pilot-improve.md.tmpl` → `{runs}/auto-pilot/runbook.md`
> **Journal:** `<paths.engine>/templates/auto-pilot-journal.md` → `{runs}/auto-pilot/journal.md`
> **Playbook:** `<paths.engine>/templates/playbooks/improve-cycle.md` → propose `{product}/playbooks/improve-cycle.md`

**Renamed from `/midas-automate` (2.6.0).** Same improve caps; default path is now **local continuous**, not “print a cloud draft and stop”.

## Response shape (always)

1. **Banner** — one line disambiguating auto-pilot vs autopilot vs Cursor `/automate` / `/loop`
2. **Verdict** — `ready` | `ready_with_warnings` | `blocked` | `stopped` + why
3. **Mode** — `local` (default) | `cloud` | `stop`
4. **Next** — one line only (e.g. “automatic mode armed — leave Cursor open”)
5. **Evidence** — runbook/journal paths; for local: loop interval + that tick #1 ran (or why skipped)

## When NOT

- No install / no `paths.state` → `/midas-reconcile` or install (`INSTALL.md`).
- No product context at all → `/midas-init` or `/midas-adopt` first.
- Want ADR-009 policy-gated sprint `tick`s → `/midas-autopilot` (needs `--autonomy`).
- Want Phase-8 gate verdict → `/close-sprint` (never claimed by auto-pilot runs).
- Laptop will sleep / Cursor will quit → use `cloud` mode (Cursor Automations) for persistence; local `/loop` dies when the session dies.

## Arguments

| Arg | Meaning |
|---|---|
| *(none)* or `local` | **Default.** Validate → write runbook → **run one improve now** → **arm `/loop`** |
| `local 15m` / `local 1h` | Same with interval (default **30m**) |
| `cloud` | Validate → emit Cursor Automation draft only (no local loop) |
| `stop` | Kill the armed local loop for this project; do not start a new one |

## Procedure

### A. Validate (read `paths.state` first)

Hard-block (`blocked`) only when:

1. `paths.state` missing or unreadable, or layout is not harness-writable.
2. **No product context** under `paths.product`. Accept **any one** of:
   - `idea.md`, `architecture.md`, `features.json` (greenfield)
   - `features.md`, `project-brief.md`, `project-state.md` (brownfield E2/E3)
   - `open-questions.md` alone is **not** enough

Warn (`ready_with_warnings`) when:

- `stage` ≠ `sprint_execution` (still OK to improve).
- Active/planned sprint looks operator-only (release/publish/smoke) — each tick must pick a **code** improvement, not the release checklist.

Record `name`, `stage`, `paths.product`, `paths.runs`.

### B. Default — `local` continuous (automatic mode)

**Do not stop after printing a draft.** Enter automatic mode in the same turn:

1. Ensure dirs: `{runs}/auto-pilot/`. Write/refresh `runbook.md` from the engine template (substitute name/product/runs/stage/date).
2. Ensure `journal.md` exists (from journal template) — append-only.
3. Propose playbook copy to `{product}/playbooks/improve-cycle.md` if missing (recommend-don’t-wall; create if user already OK’d continuous improve).
4. **Tick #1 now** — follow the runbook: orient → choose **one** candidate → branch `midas-improve/<date>-<slug>` → implement (≤~4 source files) → cheapest verify → open PR (or stop with journal row if abort). Skip inventing work if only operator tasks remain — journal `abort` + keep loop armed for later.
5. **Arm Cursor `/loop`** (fixed schedule, default interval **30m**; honor `local 15m` etc.):
   - Follow the Cursor `/loop` skill: one background shell loop with a unique sentinel (e.g. `AGENT_LOOP_TICK_midas_auto_pilot_<name>`), `notify_on_output`, PowerShell-friendly on Windows.
   - Loop payload prompt must be: *“Execute one midas-auto-pilot improve tick for this repo using `{runs}/auto-pilot/runbook.md`; append `{runs}/auto-pilot/journal.md`; do not merge; do not claim Phase-8.”*
   - Do not create a duplicate loop if one is already running for this project.
6. Confirm to the user: interval, that tick #1 ran (or aborted with reason), when the next wake fires, and that **Cursor must stay open**.

On each later wake: one improve tick only; read journal first — do not blindly repeat an identical failed attempt.

### C. `cloud` — Cursor Automations draft only

1. Same validation + write `runbook.md`.
2. Print compact table (trigger / repo / tools / branch prefix).
3. **Next:** Agents Window → Cursor `/automate` **or** https://cursor.com/automations — paste runbook (push to remote first so Cloud Agents see it).
4. Do **not** arm a local `/loop` in this mode.

### D. `stop`

1. Kill any tracked midas-auto-pilot loop PID for this project (per `/loop` stop rules).
2. Verdict `stopped`. Do not start a new loop.

### E. Optional ADR-009 handoff

If `.harness/autonomy/` exists and `midas-autopilot dry-run` shows a **code** task, mention `/midas-autopilot` as a separate actuator — never auto-`tick` from this skill.

## Caps (every tick)

- One improvement per tick; ~4 source files (+ tests).
- Branch prefix `midas-improve/`; **never merge**, deploy, or touch `.harness/autonomy/authz/**`.
- Never claim `gate: passed`, Phase-8 pass, or `/close-sprint` completion.
- Never execute operator release runbooks.

## Exit gate

- [ ] Banner disambiguated auto-pilot / autopilot / Cursor `/automate` / `/loop`.
- [ ] Verdict set with evidence paths.
- [ ] **`local`:** tick #1 attempted **and** `/loop` armed (or hard-blocked before start) — printing a draft alone is a **fail**.
- [ ] **`cloud`:** draft/runbook emitted; one Next toward Automations editor.
- [ ] **`stop`:** loop killed; no new arm.
- [ ] Did not auto-start ADR-009 `tick`, claim Phase-8, or require `MIDAS_AUTONOMY_AUTHZ_KEY`.

## Tier & delegation

- **Dispatch:** validate + local arm + first tick → **build**.
- Scout may fetch docs during a tick; do not delegate the arming exit gate away.
- Path-pass `Delegator: yes` — parents may pass this `SKILL.md` for reading; `disable-model-invocation` still forbids Skill-tool / auto slash.
