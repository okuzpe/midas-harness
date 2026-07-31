---
name: contextualize
description: Phase 1 of Midas — the gap loop. Generate and rank blocking questions, ask them in batches, fold answers into {product}/idea.md, track {product}/open-questions.md, and loop until zero blockers remain. Use after idea-intake to pin down user, problem, metric, and non-goals.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
---

# contextualize — Phase 1: the gap loop

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read the state file at **`paths.state`** (`layout` + `paths` block, or infer from disk). If the precondition stage is wrong, report and stop.

> **Paths:** Engine = `<paths.engine>/`; scripts = `<paths.scripts>/`; `{runs}/` = `paths.runs`. See `AGENTS.md` § Path resolution.

This is Midas's signature phase. A raw idea is full of unstated assumptions; building on them is the
most expensive mistake. Phase 1 systematically surfaces every **blocking** unknown and resolves it
with the user **before** any market, business, or architecture work. Playbook:
`<paths.engine>/pipeline/1-contextualize.md`.

**Precondition:** **`paths.state`** at `stage: contextualize`, with `{product}/idea.md` from Phase 0.
Read state first; write last.

## Does / Does not

| Does | Does not |
|---|---|
| Surface and resolve **blocking** unknowns with the user | Invent answers or silently assume blockers away |
| Fold answers into `{product}/idea.md` + `{product}/open-questions.md` | Overwrite the Phase-0 verbatim raw-idea block |
| Loop until zero blockers (or deferred + logged assumption) | Dump >4 questions per batch; start market/arch early |

## When NOT
- Phase 0 incomplete (no verbatim idea / pitch / mode) → `/idea-intake`.
- Zero blocking opens already and gate passed → next is `/market-research`.
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
3. **Ask in batches.** Use `AskUserQuestion` to ask the highest-severity blockers in small batches
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

On pass: record artifacts under `phases.contextualize.artifacts`, set
`phases.contextualize` to `{ status: passed, gate: passed }`, advance
`stage: market_research, stage_status: not_started`, next **`/market-research`**.
On miss: keep `stage_status: in_progress` and list outstanding blockers.
Producer never passes its own gate — the orchestrator renders it.

## Tier & delegation
- **Dispatch + gate verdict:** `orchestrate` → `midas-orchestrator`.
- **Write `{product}/idea.md`, `{product}/open-questions.md`, and `paths.state`:** `build` → `midas-builder`.
- **Evidence extraction / file reads:** `scout` → `midas-scout` or `Explore`.
