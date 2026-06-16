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

1. **Read `harness/state.yaml`.** If it is missing, report that Midas is not initialized and direct the
   user to `/midas-init`. If it exists but does not parse, say so plainly and point at `/midas-doctor`.
2. **Resolve the current stage** from `stage` + `stage_status` against the 9-phase table in
   `harness/state.schema.md` and `harness/methodology.md`.
3. **Re-derive gate status (read-only).** For the current phase, check whether its required `artifacts`
   exist on disk and summarize which gate items are satisfied vs outstanding. Do **not** grade the gate
   as passed here — that is the orchestrator's job at phase transition. Just report observed state:
   `not_started` / `in_progress` / `gate_pending` / `passed`, with the missing items if any.
4. **Print the single next action.** Map the current stage to exactly one recommended command:

   | stage | next action |
   |---|---|
   | (no state file) | `/midas-init` |
   | `idea_intake` | `/idea-intake` |
   | `contextualize` | `/contextualize` |
   | `market_research` | `/deep-research` then the market-research phase |
   | `business_case` | the business-case phase (needs human sign-off) |
   | `tech_architecture` | `/choose-architecture` |
   | `architecture_rules` | `/define-conventions` |
   | `sprint_planning` | `/plan-sprints` |
   | `sprint_execution` | `/start-sprint` (or continue the active sprint) |
   | `audit` | `/close-sprint` |
   | `shipped` | none — MVP complete |

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
Mention `/midas-doctor` only if you observed adapter or config drift while reading.
