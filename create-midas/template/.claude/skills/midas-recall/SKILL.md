---
name: midas-recall
description: Read-only context pack for resuming work — reads harness/state.yaml and assembles ~15 priority paths plus a 30-line brief (where am I, what matters, open gaps). Scout-tier; no writes. Use after a break, new session, or when midas-status suggests recall. Distinct from midas-status (PC only) and midas-sweep (hygiene).
user-invocable: true
disable-model-invocation: false
model: inherit
harness-tier: scout
recommended-model: claude-haiku-4-5
argument-hint: "[phase|sprint|task] [--focus \"<query>\"]"
---

# midas-recall — Context Pack (read-only resume)

Cheap **read-only** recovery. Assembles the smallest set of on-disk artifacts an agent needs to resume
mid-phase or mid-sprint — without dumping all of `product/` into context. **Never writes** and never
advances `stage`.

> **vs `/midas-status`:** status = program counter + single next command (~6 lines). Recall = curated
> path list (~15 max) + ~30-line brief. Status may suggest recall; it does not replace it.
>
> **vs `/midas-sweep`:** recall **reads** for orientation; sweep **finds dead flows** and ledger drift.

Full model: `harness/research/memory-model.md`.

## Args

| Arg | Default | Meaning |
|---|---|---|
| `phase` | default when `stage` has no active sprint | Pack for the current lifecycle phase |
| `sprint` | use when `sprint_execution` + active sprint | Pack for the active sprint + STM |
| `task` | narrow | Pack for the next unchecked task in the active sprint |
| `--focus "<query>"` | optional | Extra grep in `product/` + `harness/rules/`; add top hits to the pack |

## Procedure

### 1. Read state
Load `harness/state.yaml`. If missing → report `/midas-init`. Parse `stage`, `stage_status`, `mode`,
`entry_stage`, `sprints[]` (find `status: active`), `phases` ledger.

### 2. Build Context Pack (max ~15 paths, ordered)

Always include when present:

1. `harness/state.yaml`
2. Active `product/sprints/NN-*.md` (if any)
3. `.harness/sprints/NN-progress.md` (if any)

Then add by `stage` / `mode` (stop at ~15 total):

| `stage` | Additional paths (priority order) |
|---|---|
| `idea_intake` | `product/idea.md` |
| `contextualize` | `product/idea.md`, `product/open-questions.md` |
| `market_research` | `product/idea.md`, `product/market.md` (if exists) |
| `business_case` | `product/market.md`, `product/business-plan.md` |
| `tech_architecture` | `product/business-plan.md`, `product/architecture.md`, `product/adr/*` |
| `architecture_rules` | `product/architecture.md`, `harness/rules/*` (list names only if many) |
| `sprint_planning` | `product/roadmap.md`, `product/business-plan.md` MVP section |
| `sprint_execution` | `product/features.json` (features for this sprint only), `harness/rules/*` cited in sprint DoD, `product/playbooks/*` referenced in sprint tasks |

**Brownfield** (`mode: brownfield`): also `product/inventory.md`, `product/debt.md`, latest
`.harness/sweeps/sweep-NN.md` if any.

**`--focus`:** grep the query in `product/` and `harness/rules/`; append matching files until the cap.

### 3. Emit brief (~30 lines max)

```
Midas recall · <stage> · sprint <id or —>
Context pack (N paths):
  1. path
  2. path
  …

Where am I: …
What matters now: …
Open gaps: …
Conflict hints (if any): …
Do not re-read: …
```

- **Conflict hints:** only if two pack files obviously disagree (e.g. OPEN question answered in `idea.md`);
  point to `/midas-capture` or human — do not fix silently.

### 4. Suggest next command (one line)

Map to the single ritual for the stage (same table as `/midas-status`), or *continue active sprint task X*.

## Hard boundaries

- Read-only — no Edit, no `state.yaml` writes, no progress file creation (use Phase 7 / template for that).
- Do not paste full file bodies — list paths + one-line why each matters.
- If nothing exists yet (E0 empty), say so and point at `/idea-intake`.
