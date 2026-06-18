---
name: midas-status
description: Read-only lifecycle status — reads harness/state.yaml and prints the current phase, its gate status, and the single next action/command. Cheap; run anytime to orient or resume.
user-invocable: true
disable-model-invocation: false
model: inherit
harness-tier: scout
recommended-model: claude-haiku-4-5
---

# midas-status — where am I, what's next

A cheap, **read-only** status check. It never writes, never advances state, and never runs a gate to
completion — it reports the truth already on disk. Safe to run at any time, including mid-phase.

## Steps

1. **Read `harness/state.yaml`.** If it is missing, report that Midas is not installed → `/midas-init`.
   **If it exists but `setup_complete` is not `true`,** the single next action is **`/midas-init`** (finish
   the one-time setup) regardless of `stage` — say so and stop. If it exists but does not parse, say so
   plainly and point at `/midas-doctor`.
2. **Resolve the current stage** from `stage` + `stage_status` against the 9-phase table in
   `harness/state.schema.md` and `harness/methodology.md`.
3. **Re-derive gate status (read-only).** For the current phase, check whether its required `artifacts`
   exist on disk and summarize which gate items are satisfied vs outstanding. Do **not** grade the gate
   as passed here — that is the orchestrator's job at phase transition. Just report observed state:
   `not_started` / `in_progress` / `gate_pending` / `passed`, with the missing items if any.
4. **Print the single next action.** Map the current stage to exactly one recommended command — **for the
   *user* to type.** The phase rituals are gated (`disable-model-invocation`); **never call the Skill tool on
   them** (it errors) — present the command (e.g. *"👉 Run `/define-conventions`"*), don't invoke it.

   | stage | next action |
   |---|---|
   | (no state file) | `/midas-init` |
   | `setup_complete: false` | `/midas-init` (finish one-time setup) |
   | `idea_intake` | `/idea-intake` |
   | `contextualize` | `/contextualize` |
   | `market_research` | `/market-research` (reuses `/deep-research`) |
   | `business_case` | `/business-plan` (needs human sign-off) |
   | `tech_architecture` | `/choose-architecture` |
   | `architecture_rules` | `/define-conventions` |
   | `sprint_planning` | `/plan-sprints` |
   | `sprint_execution` | `/close-sprint` once the active sprint's tasks are done and tests run; otherwise `/start-sprint` (or continue the active sprint) |
   | `shipped` | none — MVP complete |

5. **Surface the tribunal checkpoint (recommended, optional — never force).** At a high-leverage decision
   point, add **one** line recommending a whole-project audit *before* the gate — running it (or not) is
   the human's call, and `/midas-tribunal` is non-advancing, so this is a prompt, not a block:
   - `business_case` → *before* the go/no-go sign-off
   - `architecture_rules` → *before* `/define-conventions` freezes the rules
   - the **final sprint before ship** (no planned sprints left) → *before* declaring MVP complete

   At those points print: *"💡 Before this gate, consider `/midas-tribunal` (optional, your call) — it
   asks whether the decisions are *right*, not just whether the code conforms."* Skipping is fine; do not
   block. (If a recent `.harness/debates/debate-NN.md` already covers this checkpoint, say so instead.)

## Output format

Keep it to ~6 lines:

```
Midas · <name> · <mode> · profile <cost_profile>
Phase <N> — <phase title> · <stage_status>
Gate: <X/Y satisfied> — outstanding: <items, or "none">
Active sprint: <id title status, or "—">
Next: <single command>
```

If `stage_status` is `in_progress`, add one line naming what is left before the gate can be re-run.
At a **tribunal checkpoint** (step 5), add the recommended-`/midas-tribunal` line (optional, your call).
Mention `/midas-doctor` only if you observed adapter or config drift while reading.
