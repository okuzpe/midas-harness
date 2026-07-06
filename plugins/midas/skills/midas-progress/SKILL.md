---
name: midas-progress
description: Phase 7 STM writer — updates {runs}/sprints/NN-progress.md after tasks or significant decisions (Done rows, Learned observations, Next line). Build-tier; complements read-only /midas-recall. Use mid-sprint when session-continuity rule applies.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[--task \"<id>\" --proof \"<evidence>\" --tool \"<runner>\"]"
---

# midas-progress — Sprint STM (session memory)

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.

> **Paths:** `{runs}/sprints/NN-progress.md` from template `<paths.engine>/templates/sprint-progress.md`.
> See `harness/rules/session-continuity.md` and `harness/research/memory-model.md`.

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
   - Completed task → append a **Done** row (`Task | Proof | Tool`).
   - Significant decision → append an **Observations** subsection (What / Why / Where / Learned).
   - Update **Next** to the single following task or blocker.
   - Refresh **Last updated** (ISO date).
2. **Tool column** — use canonical values from the template (`test-runner`, `context7`, `playwright-mcp`, …).
3. **Do not** advance `stage`, close the sprint, or edit `product/features.json` status here — that is
   implementation + `/close-sprint` territory.
4. Print one line: `STM updated → {runs}/sprints/NN-progress.md`.

## Hard boundaries

- No silent creation without an active sprint.
- No vector store / hidden memory (ADR-003).
- Prefer small, frequent updates over one giant dump at sprint end.
