# Phase 7 — Sprint Execution

**Stage enum:** `sprint_execution` | **Tier:** build (implement)

## Purpose

Implement the active sprint's tasks, verify acceptance criteria, and prepare the sprint
for Phase 8 audit. Code is written here — fetching current docs is mandatory for every third-party
library touched (Context7 recommended, or your own doc tool). The build tier drives; the orchestrate tier reviews before closing.

## Inputs

- Active sprint file `{product}/sprints/NN-<slug>.md` (from Phase 6)
- Machine-checkable spec `{product}/features.json` (seeded at Phase 6 from the MVP scope) — the
  passing/failing ledger this sprint advances (see `<paths.engine>/templates/features.json.tmpl`)
- `<paths.engine>/rules/*` plus `<paths.rules>/*` (project overlays win by slug) — must be respected at every step
- `<paths.engine>/design-system/tokens.json` / `tokens.css` — all UI uses tokens
- `paths.state` (stage must be `sprint_execution`, sprint `status: active`)

## Key steps

1. **Read the sprint file.** Confirm the sprint is `active` in `paths.state`.
   Work only on tasks listed in this sprint; ignore future sprints.
   **New session or stale progress:** run `/midas-recall sprint` (optional) or read
   `{runs}/sprints/NN-progress.md` before implementing. On first activation, seed progress from
   `<paths.engine>/templates/sprint-progress.md` → `{runs}/sprints/NN-progress.md`.
2. **Implement tasks — one feature at a time.** Work a single task through to *done* (past
   verification) before starting the next; never batch-implement and verify only at the end. This
   incremental discipline is what keeps a long run from exhausting context and drifting — it matters
   most when a local `build` model with a short usable context is driving (`<paths.engine>/rules/model-routing.md`).
   Keep a running `{runs}/sprints/NN-progress.md` (use the **What / Why / Where / Learned** rows in
   `<paths.engine>/templates/sprint-progress.md`) so a fresh session resumes without re-reading everything. For each task:
   a. **Pick the implementation route** before coding (`<paths.engine>/rules/organic-routing.md`):
      *inline* (1–3 files / mechanical), *delegated* (4+ files or 2+ non-trivial writes — one scout
      and/or builder with matched `SKILL.md` paths from `<paths.engine>/skill-registry.md`), or
      *plan-first* only after explicit user OK (task-split / ADR / Learned / `/midas-explore` — never
      silent `/plan-sprints`). Then apply model-routing for tier. Record `Route:` on Done rows when
      the cluster spans ≥4 files.
   b. Before writing code against any third-party library, call `resolve-library-id`
      then `get-library-docs` at the pinned version via Context7 (scout tier).
      Use the web fallback if Context7 is unavailable; never generate from memory.
   c. Write code that matches the conventions in `<paths.engine>/conventions.md` and
      `{product}/conventions.md`. Match surrounding style; prefer reuse over new abstractions.
   d. Write tests alongside the feature (not after). Test behavior, not implementation.
   e. **Verify the task before checking it off (the inner verify→fix loop).** Run the
      [`verification.md`](../rules/verification.md) ladder for what you just changed — rungs 1–3
      always (static gate → behavioural tests → runtime smoke), plus rung 4 (drive + inspect via
      `/midas-verify` or ad-hoc `/midas-qa` on the diff) when the task is UI-touching. **Observe the actual output,
      fix any failure, and re-run until green** — bounded at ~3 self-fix rounds, after which you stop
      and surface the blocker to the human (recommend-don't-wall). You self-check the cheap rungs
      here; the *independent* verdict (rung 5) is rendered at Phase 8, never by you.
   f. Check the task off `## Tasks` in the sprint file **only after it passes verification**, noting
      the proof (command output, test name, or screenshot reference) **and the tool/MCP that proved it**
      (e.g. `test-runner`, `context7`, `agent-browser`, `playwright-mcp`, `@playwright/cli`). Mirror the same in
      `{runs}/sprints/NN-progress.md` § Done (Task · Proof · Tool · **Route** when ≥4 files). If the task completes a feature in
      `{product}/features.json`, flip that feature's `status` to `passing` and fill its `evidence` —
      editing **only** `status`/`evidence`, never the spec fields.
3. **Verify acceptance criteria.** After all tasks are checked, run or demonstrate
   every item in `## Acceptance criteria`. Record evidence (output, screenshot reference,
   or test name) next to each item. For a UI-touching sprint, run `/midas-verify` (`--scope web|mobile|all`
   per `architecture.md`) so each criterion is proven and frozen to `{runs}/verifications/verify-NN.md`.
   **Optional inner loop:** `/midas-qa` on the branch diff (evidence in `{runs}/qa/`, non-gate).
   **Optional (recommended for large or messy sprints):** run `/midas-sweep` before handing off to
   Phase 8 — surface dead flows and ledger drift so the audit grades real behaviour, not cruft.
4. **Self-check DoD.** Walk the `## Definition of Done` list:
   - Tests pass
   - No convention violations (check against the combined base and project rule patterns)
   - No new lint or type errors
   - No secrets committed
5. **Update `paths.state`.** Refresh the sprint's `last_touched` to today. Keep `status: active`
   until `/close-sprint` (Phase 8) marks the sprint `done` after a passing audit.
6. **Hand off to Phase 8.** The sprint is now ready for the orchestrate-tier audit via `/close-sprint`.
   Do not advance `stage` — Phase 8 does that after the audit passes.

## Output artifacts

| File | Notes |
|---|---|
| Code + tests | In the project source tree per `<paths.rules>/folder-structure.md` |
| `{product}/sprints/NN-<slug>.md` | Updated: tasks checked, acceptance evidence noted |
| `{product}/features.json` | Updated: features completed this sprint flipped to `passing` with `evidence` |
| `{runs}/sprints/NN-progress.md` | Running progress log for cross-session continuity |

## Exit gate checklist

- [ ] All tasks in `## Tasks` are checked off
- [ ] Each task passed the `verification.md` inner loop (static + tests + runtime smoke; browser drive+inspect for UI) before check-off
- [ ] Acceptance criteria are verified with evidence (UI sprints: a `/midas-verify` record exists)
- [ ] Features completed this sprint are `passing` in `{product}/features.json`, each with `evidence`
- [ ] Every third-party library call was preceded by a Context7 fetch (or documented web fallback)
- [ ] Tests are present and passing for all new behavior
- [ ] No convention violations detectable by the combined rule check patterns
- [ ] No secrets in committed files
- [ ] Sprint remains `status: active` in `paths.state` until `/close-sprint` passes

## Recommended tier + agents

- **Implement + write tests:** `build` (`midas-builder`, `claude-sonnet-4-6`)
- **Context7 fetches:** `scout` (`midas-scout`, `claude-haiku-4-5`)
- **Final review before handoff:** `orchestrate` (`midas-orchestrator`, `claude-opus-4-8`)
