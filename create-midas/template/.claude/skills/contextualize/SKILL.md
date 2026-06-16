---
name: contextualize
description: Phase 1 of Midas — the gap loop. Generate and rank blocking questions, ask them in batches, fold answers into product/idea.md, track product/open-questions.md, and loop until zero blockers remain. Use after idea-intake to pin down user, problem, metric, and non-goals.
user-invocable: true
disable-model-invocation: false
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
---

# contextualize — Phase 1: the gap loop

This is Midas's signature phase. A raw idea is full of unstated assumptions; building on them is the
most expensive mistake. Phase 1 systematically surfaces every **blocking** unknown and resolves it
with the user **before** any market, business, or architecture work. Playbook:
`harness/pipeline/1-contextualize.md`.

**Precondition:** `harness/state.yaml` at `stage: contextualize`, with `product/idea.md` from Phase 0.
Read state first; write last.

## The loop

Repeat until there are **zero blocking** open questions:

1. **Generate questions.** From `product/idea.md`, enumerate the unknowns that, if answered wrong,
   would invalidate downstream phases. Cover at least: **target user**, the **problem** (and evidence
   it's real), the **success metric** (one measurable signal of "this worked"), and **non-goals**
   (what the MVP deliberately won't do).
2. **Rank by severity.** Tag each `blocking` (a later phase cannot proceed correctly without it) or
   `non-blocking` (nice to know; defer). Only `blocking` questions gate this phase.
3. **Ask in batches.** Use `AskUserQuestion` to ask the highest-severity blockers in small batches
   (≈3-4 at a time), each with a crisp default/option set so the user can answer fast. Do not dump 20
   questions at once.
4. **Fold answers in.** Update `product/idea.md` (v2) with the resolved facts — sharpening the user,
   problem, metric, and non-goals sections. Keep the verbatim raw-idea block from Phase 0 intact.
5. **Maintain the ledger.** Keep `product/open-questions.md` current: each question with its status
   (`open` / `answered` / `deferred`), severity, the answer or the recorded assumption, and the date.
   A **deferred** blocker is only allowed if the user explicitly accepts a written assumption in its
   place — that assumption is logged here and surfaced by `/midas-status`.
6. **Re-rank and loop.** New answers often spawn new questions. Regenerate, re-rank, and continue until
   no `blocking` question remains `open`.

## Exit gate (Phase 1)

The orchestrator advances to Phase 2 **iff**, with on-disk evidence:

- **0 blocking** open questions remain `open` in `product/open-questions.md` (deferred blockers carry an
  explicit, user-accepted assumption);
- **user, problem, success metric, and non-goals** are each defined in `product/idea.md` v2.

When satisfied, record both artifacts under `phases.contextualize.artifacts`, set
`phases.contextualize` to `{ status: passed, gate: passed }`, advance `stage: market_research,
stage_status: not_started`, refresh `updated`, and tell the user the next action is the **market
research** phase (it reuses `/deep-research`). If blockers remain, keep `stage_status: in_progress` and
list the outstanding blocking questions. The producer never passes its own gate — the orchestrator renders it.
