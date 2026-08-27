---
name: midas-status
user-surface: primary
description: Read-only lifecycle status — reads the state file (paths.state) and prints the current phase, its gate status, and the single next action/command. Cheap; run anytime to orient or resume.
user-invocable: true
disable-model-invocation: false
model: inherit
harness-tier: scout
recommended-model: claude-haiku-4-5
---

# midas-status — where am I, what's next

> **Paths / state:** `<paths.engine>/templates/skill-state-ritual.md` (read-only) + `AGENTS.md` § Path resolution.

A cheap, **read-only** status check. It never writes, never advances state, and never runs a gate to
completion — it reports the truth already on disk. Safe to run at any time, including mid-phase.

> **Lost on *which* skill?** Do not invent a second router — use
> `docs/skills.md` § Which command when (install: `<paths.engine>/docs/skills.md`) or `/midas-help`.
> Audit roles: same file § Audits (+ `<paths.engine>/templates/audit-checklists.md`).

## Steps

1. **Read the state file** at `paths.state`. If it is missing, report that Midas is not installed →
   run `npx github:okuzpe/midas-harness --diagnose` or `/midas-reconcile` (or install per INSTALL.md).
   **If it exists but `setup_complete` is not `true`,** the single next action is **`/midas-init`** (finish
   the one-time setup) regardless of `stage` — say so and stop. If it exists but does not parse, say so
   plainly and point at `/midas-doctor`.
2. **Resolve the current stage** from `stage` + `stage_status` against the 9-phase table in
   `<paths.engine>/state.schema.md` and `<paths.engine>/methodology.md`.
3. **Re-derive gate status (read-only).** For the current phase, check whether its required `artifacts`
   exist on disk and summarize which gate items are satisfied vs outstanding. Do **not** grade the gate
   as passed here — that is the orchestrator's job at phase transition. Just report observed state:
   `not_started` / `in_progress` / `gate_pending` / `passed`, with the missing items if any.
4. **Print the single next action.** Map the current stage to exactly one recommended command — **for the
   *user* to type.** The phase rituals are gated (`disable-model-invocation`); **never call the Skill tool on
   them** (it errors) — present the command (e.g. *"👉 Run `/define-conventions`"*), don't invoke it.

   **Runtime table:** read `<paths.engine>/stage-command-table.yaml` on disk (parsed by
   `<paths.scripts>/stage-command-table.mjs`). That YAML is **generated** from `STAGE_ROWS` in
   `stage-command-table.mjs` — engine maintainers edit the JS rows, then `doctor --fix` / `align`.
   **Do not duplicate the YAML in this skill** — resolve each run from the file:

   - `(no state file)` → `/midas-init` (or diagnose per step 1)
   - `setup_complete: false` → `/midas-init` (finish one-time setup), regardless of `stage`
   - **`track: lite` overlay** (not a second stage table — see `<paths.engine>/pipeline/lite.md`):
     print `Track: lite` (or `Track: full` when `track` is absent/`full`). **Never** set Next to
     `/market-research` or `/business-plan` when `track: lite`. If `stage` is one of `idea_intake` …
     `architecture_rules`, Next is **not** that row's `command`: finish Lite Idea+Plan (cite
     `pipeline/lite.md`) or `/plan-sprints` once `{product}/idea.md`, thin architecture, lean rules,
     and `{product}/business-plan.md` exist. Missing `{product}/market.md` is OK on lite.
   - Otherwise use the row for `paths.state → stage`:
     - default next ritual → that row's `command`
     - honor each row's `note` when present (e.g. human sign-off on `business_case`)
     - `sprint_execution` → pick **one** command from sprint reality:
       - sprint not yet `active` → `command` (`/start-sprint`)
       - sprint `active`, tasks remain → continue per `<paths.engine>/pipeline/7-sprint-execution.md`
         (path-pass STM via `<paths.engine>/skills/midas-progress/SKILL.md` after significant tasks — do **not**
         Skill-tool invoke; prefer telling the user to keep working or run `/close-sprint` when ready)
       - UI journeys not frozen → `verify_ui` (`/midas-verify`) when the sprint is UI-touching
       - visual redesign before JSX → `redesign_ui` (`/midas-design`)
       - tasks done + tests green → `command_when_done` (`/close-sprint`) — close path-passes
         internal hygiene / diff-gates / lean as needed
       - ad-hoc branch smoke only → mention optional path-pass `qa_internal`
         (`<paths.engine>/skills/midas-qa/SKILL.md` under Phase 7; power-user slash `/midas-qa`) — never replaces
         verify before close; do **not** make qa the sole Next line unless the user asked for smoke only
     - `shipped` → `command: null` (MVP complete; no next ritual)

5. **Surface optional prompts (never force).** At a high-leverage decision point, add **one** line if relevant:
   - **Tribunal** — see tribunal table below
   - **Hygiene** — at `sprint_planning`: *"💡 Before seeding `features.json`, consider `/midas-hygiene docs` (optional) — reconcile the ledger with what exists."*; at `sprint_execution` when the active sprint's tasks look done: *"💡 Before `/close-sprint`, close will path-pass `/midas-hygiene` on large diffs (optional)."*; after brownfield (`mode: brownfield` in state): *"💡 Post-adopt `/midas-hygiene` (optional) helps drop dead flows before the next gate."*
   - **Lean review** — covered by `/midas-hygiene` (lean mode) or close Step 0; optional tip: *"💡 Fat diff? `/midas-hygiene lean` for a delete-list."*
   - **STM / progress** — when an active sprint is missing `{runs}/sprints/NN-progress.md` or `last_touched` is stale: *"💡 Session continuity: path-pass `<paths.engine>/skills/midas-progress/SKILL.md` (or type `/midas-progress`) so STM exists before Phase 8."*
   - **Recall** — when `stage_status: in_progress`, or an active sprint's `last_touched` is **> 7 days** ago, or `{runs}/sprints/NN-progress.md` is missing for an active sprint: *"💡 Resuming? Run `/midas-recall` (optional) for a context pack — distinct from this status line."*
   Skipping is fine; do not block.

   **Tribunal checkpoints** (original step 5):
   - `business_case` → *before* the go/no-go sign-off
   - `architecture_rules` → *before* `/define-conventions` freezes the rules
   - the **final sprint before ship** (no planned sprints left) → *before* declaring MVP complete

   At those points print: *"💡 Before this gate, consider `/midas-tribunal` (optional, your call) — it
   asks whether the decisions are *right*, not just whether the code conforms."* Skipping is fine; do not
   block. (If a recent `{runs}/debates/debate-NN.md` already covers this checkpoint, say so instead.)

## Output format

Keep it to ~6 lines:

```
Midas · <name> · <mode> · profile <cost_profile>
Track: <lite|full>
Phase <N> — <phase title> · <stage_status>
Gate: <X/Y satisfied> — outstanding: <items, or "none">
Active sprint: <id title status, or "—">
Next: <single command>
```

If `stage_status` is `in_progress`, add one line naming what is left before the gate can be re-run.
At a **tribunal checkpoint** (step 5), add the recommended-`/midas-tribunal` line (optional, your call).
At a **hygiene checkpoint** (`sprint_planning`, end of `sprint_execution`, or `mode: brownfield`), add the
optional `/midas-hygiene` line from step 5 when relevant (escape hatch — not the sole Next).
At a **lean checkpoint** (end of `sprint_execution` with a large diff), add the optional `/midas-hygiene lean`
line from step 5 when relevant.
At a **STM gap** (active sprint, missing or empty `{runs}/sprints/NN-progress.md`), add the progress
path-pass reminder from step 5.
At a **recall checkpoint** (`stage_status: in_progress`, stale `last_touched` > 7 days, or missing progress
file for active sprint), add the recommended-`/midas-recall` line from step 5 when relevant.
Mention `/midas-doctor` only if you observed adapter or config drift while reading.

## Tier & delegation
- **Dispatch (read-only):** `scout` → `midas-scout` (or run inline on the fastest session model).
- Do **not** escalate to orchestrate/build — this skill never writes or renders a gate verdict.
- Respect `cost_profile` as intent on non-Claude hosts (use the cheapest model).
