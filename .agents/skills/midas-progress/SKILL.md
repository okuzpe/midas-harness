---
name: midas-progress
description: "Phase 7 STM writer — updates {runs}/sprints/NN-progress.md after tasks or significant decisions (Done rows, Learned observations, Next line). Build-tier; complements read-only /midas-recall. Use mid-sprint when session-continuity rule applies."
metadata:
  midas-argument-hint: "[--task \\\"<id>\\\" --proof \\\"<evidence>\\\" --tool \\\"<runner>\\\"]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-progress — Sprint STM (session memory)

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).

> **Paths:** `{runs}/sprints/NN-progress.md` from template `<paths.engine>/templates/sprint-progress.md`.
> See `<paths.engine>/rules/session-continuity.md` and `<paths.engine>/research/memory-model.md`.

Cheap **write** path for Phase 7 continuity. Updates the active sprint's progress file so `/midas-recall` and
Phase-8 audits see git-visible evidence of what was proved and how.

> **vs `/midas-recall`:** recall **reads** a context pack; progress **writes** STM. Status may suggest recall;
> progress is for after substantive work lands.

## Preconditions

1. Read **`paths.state`**. `stage` must be `sprint_execution` with an `active` sprint in `sprints[]`.
2. If `{runs}/sprints/NN-progress.md` is missing, copy from `<paths.engine>/templates/sprint-progress.md`
   and fill the sprint id/title header.

## Procedure

1. **Identify the delta** from args or the current session:
   - Completed task → append a **Done** row (`Task | Proof | Tool | Route`). Include **Route**
     (`inline` / `delegated` / `plan-first`) when the task cluster spans ≥4 files
     (`<paths.engine>/rules/organic-routing.md`).
   - Significant decision → append an **Observations** subsection (What / Why / Where / Learned);
     note plan-first user acceptance in Learned when applicable.
   - Update **Next** to the single following task or blocker.
   - Refresh **Last updated** (ISO date).
2. **Tool column** — use canonical values from the template (`test-runner`, `context7`, `playwright-mcp`, …).
3. **Do not** advance `stage`, close the sprint, or edit `{product}/features.json` status here — that is
   implementation + `/close-sprint` territory.
4. Print one line: `STM updated → {runs}/sprints/NN-progress.md`.

## Hard boundaries

- No silent creation without an active sprint.
- No vector store / hidden memory (ADR-003).
- Prefer small, frequent updates over one giant dump at sprint end.

## When NOT

- No active sprint / wrong stage → `/midas-status` or `/start-sprint`.
- Need a read-only context pack only → `/midas-recall` (does not write STM).
- Closing / grading the sprint → `/close-sprint`.
- Ad-hoc UI smoke without STM intent → `/midas-qa`.

## Exit gate
- [ ] `{runs}/sprints/NN-progress.md` updated (Done and/or Observations and/or Next as applicable).
- [ ] Every new **Done** row has non-empty **Proof** and **Tool** (and **Route** when ≥4-file cluster).
- [ ] `stage` / sprint status unchanged (no gate advance).
- [ ] Chat shows `STM updated → {runs}/sprints/NN-progress.md`.
- **Optional — lifecycle journal:** after a substantive STM update,
  `node <paths.scripts>/lifecycle-journal.mjs session_note --detail "sprint-NN-progress"` (fail-open; metadata only).

## Tier & delegation
- **Dispatch + progress file writes:** `build` → `midas-builder`.
- Diff/status extraction → `scout` (`midas-scout`) when helpful.
- No gate verdict — orchestrate stays out.
- Respect `cost_profile`.
