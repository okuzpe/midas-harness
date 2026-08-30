---
name: contextualize
description: "Phase 1 of Midas — the gap loop. Generate and rank blocking questions, ask them in batches, fold answers into {product}/idea.md, track {product}/open-questions.md, and loop until zero blockers remain. Use after idea-intake to pin down user, problem, metric, and non-goals."
metadata:
  midas-disable-model-invocation: true
  midas-harness-tier: orchestrate
  midas-model: inherit
  midas-recommended-model: claude-opus-4-8
  midas-user-invocable: true
  midas-user-surface: primary
---
# contextualize — Phase 1: the gap loop

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Prompt tool:** `AskQuestion`. On Claude Code, fall back to `AskUserQuestion` if AskQuestion is not wired.

This is Midas's signature phase. A raw idea is full of unstated assumptions; building on them is the
most expensive mistake. Phase 1 systematically surfaces every **blocking** unknown and resolves it
with the user **before** any market, business, or architecture work. Playbook:
`<paths.engine>/pipeline/1-contextualize.md`.

**Precondition:** **`paths.state`** at `stage: contextualize`, with `{product}/idea.md` from Phase 0.

## Does / Does not

| Does | Does not |
|---|---|
| Surface and resolve **blocking** unknowns with the user | Invent answers or silently assume blockers away |
| Fold answers into `{product}/idea.md` + `{product}/open-questions.md` | Overwrite the Phase-0 verbatim raw-idea block |
| Loop until zero blockers (or deferred + logged assumption) | Dump >4 questions per batch; start market/arch early |

## When NOT
- Phase 0 incomplete (no verbatim idea / pitch / mode) → `/idea-intake`.
- Zero blocking opens already and gate passed → next is `/market-research` (`track: full` only).
  When `track: lite`, next is `/midas-status` (overlay → remaining Idea+Plan or `/plan-sprints`) —
  **never `/market-research`**.
- User wants status only → `/midas-status`.

**Anti-rationalization:** “we’ll figure it out in build” is **not** a deferred assumption — deferrals
need an explicit user-accepted written assumption in `{product}/open-questions.md`.

## The loop

Repeat until there are **zero blocking** open questions:

1. **Generate questions.** From `{product}/idea.md`, enumerate the unknowns that, if answered wrong,
   would invalidate downstream phases. Cover at least: **target user**, the **problem** (and evidence
   it's real), the **success metric** (one measurable signal of "this worked"), and **non-goals**
   (what the MVP deliberately won't do).
2. **Rank by severity.** Tag each `blocking` (a later phase cannot proceed correctly without it) or
   `non-blocking` (nice to know; defer). Only `blocking` questions gate this phase.
3. **Ask in batches.** Use `AskQuestion` to ask the highest-severity blockers in small batches
   (≈3-4 at a time), each with a crisp default/option set so the user can answer fast. Do not dump 20
   questions at once.
4. **Fold answers in.** Update `{product}/idea.md` (v2) with the resolved facts — sharpening the user,
   problem, metric, and non-goals sections. Keep the verbatim raw-idea block from Phase 0 intact.
5. **Maintain the ledger.** Keep `{product}/open-questions.md` current: each question with its status
   (`open` / `answered` / `deferred`), severity, the answer or the recorded assumption, and the date.
   A **deferred** blocker is only allowed if the user explicitly accepts a written assumption in its
   place — that assumption is logged here and surfaced by `/midas-status`.
6. **Re-rank and loop.** New answers often spawn new questions. Regenerate, re-rank, and continue until
   no `blocking` question remains `open`.

## Exit gate (Phase 1)

Advance to Phase 2 **iff** (on-disk evidence):

- [ ] **0 blocking** questions remain `open` in `{product}/open-questions.md`.
- [ ] Every deferred blocker has an explicit, user-accepted assumption (dated).
- [ ] **user, problem, success metric, and non-goals** are each defined in `{product}/idea.md` v2.
- [ ] Phase-0 raw-idea block is still intact (untouched).
- [ ] Gate verdict written to `{runs}/audits/gate-01.md`.

On pass (`track: full`): freeze `{runs}/audits/gate-01.md` from
`<paths.engine>/templates/gate-record.md`, record artifacts under `phases.contextualize.artifacts`,
set `phases.contextualize` to `{ status: passed, gate: passed }`, advance
`stage: market_research, stage_status: not_started`, next **`/market-research`**.
On pass (`track: lite`): freeze `{runs}/audits/gate-01.md` the same way; record
`phases.contextualize` passed or skipped-with-assumption; do **not** set `stage: market_research`;
continue Idea+Plan (architecture + business-plan stub) then **`/plan-sprints`**. Next is
**never `/market-research`**. See `<paths.engine>/pipeline/lite.md`.
On miss: keep `stage_status: in_progress` and list outstanding blockers.
Producer never passes its own gate — the orchestrator renders it.

## Tier & delegation
- **Dispatch + gate verdict:** `orchestrate` → `midas-orchestrator`.
- **Write `{product}/idea.md`, `{product}/open-questions.md`, `{runs}/audits/gate-01.md`, and `paths.state`:** `build` → `midas-builder`.
- **Evidence extraction / file reads:** `scout` → `midas-scout` or `Explore`.
