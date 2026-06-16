# Phase 1 — Contextualize & Gap Audit

**Stage enum:** `contextualize` | **Tier:** orchestrate (gap loop)

## Purpose

Turn the raw idea into a structured product definition. Identify every BLOCKING gap
(missing user, problem, success metric, or explicit non-goal) and resolve it via a
question loop with the human before advancing. Zero unresolved blockers is the gate.

## Inputs

- `product/idea.md` (from Phase 0)
- `harness/state.yaml` (stage must be `contextualize`)

## Key steps

### Gap / question loop (repeat until 0 blockers)

1. **Analyze `product/idea.md`.** Extract or flag:
   - Target user / persona
   - Core problem being solved
   - Primary success metric (measurable, time-bound)
   - Non-goals (explicit scope exclusions)
2. **Classify gaps.** For each missing field, decide:
   - `BLOCKING` — cannot advance without it (e.g. no identifiable user)
   - `DEFERRED` — nice-to-know; record as an open question and move on
3. **Ask the human.** Present all BLOCKING questions in a single numbered list.
   Wait for answers. Do not advance until every BLOCKING item is resolved.
4. **Re-analyze.** After each answer batch, re-run the gap check.
   Repeat until the blocking list is empty.
5. **Update `product/idea.md` v2.** Rewrite the document with all four fields
   (user, problem, metric, non-goals) clearly defined. Preserve the `## Raw idea`
   section verbatim; add a `## Contextualized` section below it.
6. **Write `product/open-questions.md`.** List DEFERRED questions with owner and
   target-phase. BLOCKING questions resolved in this loop are marked `resolved`.
7. **Advance.** Set `stage_status: gate_pending`; run the exit gate.
   On pass, write `gate: passed` and set `stage: market_research`.

## Output artifacts

| File | Notes |
|---|---|
| `product/idea.md` | v2 — adds `## Contextualized` section |
| `product/open-questions.md` | All open questions, blocking/deferred/resolved |

## Exit gate checklist

- [ ] `product/idea.md` contains `## Contextualized` with all four fields defined
- [ ] Target user is named and specific (not "everyone")
- [ ] Primary success metric is measurable and time-bound
- [ ] At least one explicit non-goal is stated
- [ ] `product/open-questions.md` exists; zero items are marked `BLOCKING`
- [ ] Gate verdict written to `.harness/audits/audit-01.md`

## Recommended tier + agents

- **Gap loop + audit:** `orchestrate` (`keel-orchestrator`, `claude-opus-4-8`)
- **File writes:** `build` (`keel-builder`, `claude-sonnet-4-6`)
