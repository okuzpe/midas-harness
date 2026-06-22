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
   d. **Verify the task before checking it off (the inner verify→fix loop).** Run the
      [`verification.md`](../rules/verification.md) ladder for what you just changed — rungs 1–3
      always (static gate → behavioural tests → runtime smoke), plus rung 4 (drive + inspect in a
      real browser via `/midas-verify`) when the task is UI-touching. **Observe the actual output,
      fix any failure, and re-run until green** — bounded at ~3 self-fix rounds, after which you stop
      and surface the blocker to the human (recommend-don't-wall). You self-check the cheap rungs
      here; the *independent* verdict (rung 5) is rendered at Phase 8, never by you.
   e. Check the task off `## Tasks` in the sprint file **only after it passes verification**, noting
      the proof (command output, test name, or screenshot reference).
3. **Verify acceptance criteria.** After all tasks are checked, run or demonstrate
   every item in `## Acceptance criteria`. Record evidence (output, screenshot reference,
   or test name) next to each item. For a UI-touching sprint, run `/midas-verify` so each
   criterion is proven in a real browser (Playwright drives the flow; Chrome DevTools inspects
   runtime health) and frozen to `.harness/verifications/verify-NN.md`.
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
- [ ] Each task passed the `verification.md` inner loop (static + tests + runtime smoke; browser drive+inspect for UI) before check-off
- [ ] Acceptance criteria are verified with evidence (UI sprints: a `/midas-verify` record exists)
- [ ] Every third-party library call was preceded by a Context7 fetch (or documented web fallback)
- [ ] Tests are present and passing for all new behavior
- [ ] No convention violations detectable by the `harness/rules/` check patterns
- [ ] No secrets in committed files
- [ ] Sprint `status: done` recorded in `harness/state.yaml`
- [ ] Gate verdict written to `.harness/audits/audit-NN.md` (by Phase 8)

## Recommended tier + agents

- **Implement + write tests:** `build` (`midas-builder`, `claude-sonnet-4-6`)
- **Context7 fetches:** `scout` (`midas-scout`, `claude-haiku-4-5`)
- **Final review before handoff:** `orchestrate` (`midas-orchestrator`, `claude-opus-4-8`)
