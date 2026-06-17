# Phase 7 — Sprint Execution

**Stage enum:** `sprint_execution` | **Tier:** build (implement)

## Purpose

Implement the active sprint's tasks, verify acceptance criteria, and prepare the sprint
for Phase 8 audit. Code is written here — fetching current docs is mandatory for every third-party
library touched (Context7 recommended, or your own doc tool). The build tier drives; the orchestrate tier reviews before closing.

## Inputs

- Active sprint file `product/sprints/NN-<slug>.md` (from Phase 6)
- `harness/rules/*` (Phase 5) — must be respected at every step
- `harness/design-system/tokens.json` / `tokens.css` — all UI uses tokens
- `harness/state.yaml` (stage must be `sprint_execution`, sprint `status: active`)

## Key steps

1. **Read the sprint file.** Confirm the sprint is `active` in `state.yaml`.
   Work only on tasks listed in this sprint; ignore future sprints.
2. **Implement tasks.** For each task:
   a. Before writing code against any third-party library, call `resolve-library-id`
      then `get-library-docs` at the pinned version via Context7 (scout tier).
      Use the web fallback if Context7 is unavailable; never generate from memory.
   b. Write code that matches the conventions in `harness/conventions.md` and
      `product/conventions.md`. Match surrounding style; prefer reuse over new abstractions.
   c. Write tests alongside the feature (not after). Test behavior, not implementation.
   d. Check each completed task off `## Tasks` in the sprint file.
3. **Verify acceptance criteria.** After all tasks are checked, run or demonstrate
   every item in `## Acceptance criteria`. Record evidence (output, screenshot reference,
   or test name) next to each item.
4. **Self-check DoD.** Walk the `## Definition of Done` list:
   - Tests pass
   - No convention violations (check against `harness/rules/` patterns)
   - No new lint or type errors
   - No secrets committed
5. **Update `state.yaml`.** Set the sprint's `status: done` and `last_touched` to today.
   Set `stage_status: gate_pending`.
6. **Hand off to Phase 8.** The sprint is now ready for the orchestrate-tier audit.
   Do not advance `stage` — Phase 8 does that after the audit passes.

## Output artifacts

| File | Notes |
|---|---|
| Code + tests | In the project source tree per `harness/rules/folder-structure.md` |
| `product/sprints/NN-<slug>.md` | Updated: tasks checked, acceptance evidence noted |

## Exit gate checklist

- [ ] All tasks in `## Tasks` are checked off
- [ ] Acceptance criteria are verified with evidence
- [ ] Every third-party library call was preceded by a Context7 fetch (or documented web fallback)
- [ ] Tests are present and passing for all new behavior
- [ ] No convention violations detectable by the `harness/rules/` check patterns
- [ ] No secrets in committed files
- [ ] Sprint `status: done` recorded in `harness/state.yaml`
- [ ] Gate verdict written to `.harness/audits/audit-07-NN.md` (by Phase 8)

## Recommended tier + agents

- **Implement + write tests:** `build` (`midas-builder`, `claude-sonnet-4-6`)
- **Context7 fetches:** `scout` (`midas-scout`, `claude-haiku-4-5`)
- **Final review before handoff:** `orchestrate` (`midas-orchestrator`, `claude-opus-4-8`)
