# Phase 3 — Business Case

**Stage enum:** `business_case` | **Tier:** orchestrate (decide)

> Run this phase with the **`/business-plan`** skill (it captures MVP scope, measurable metrics, and the
> go/no-go with human sign-off). This playbook is its reference.

## Purpose

Produce a concise go/no-go document that pins MVP scope, defines measurable success
metrics, and requires explicit human sign-off before committing engineering effort.
This is an irreversible decision point; use the orchestrate tier.

## Inputs

- `product/idea.md` v2 (Phase 1)
- `product/market.md` (Phase 2)
- `harness/state.yaml` (stage must be `business_case`)

## Key steps

1. **Draft MVP scope.** From the problem + differentiation thesis, define the smallest
   deliverable that proves the core value proposition. List what is explicitly OUT of MVP.
2. **Define metrics.** Map to the success metric from Phase 1. Add a secondary leading
   indicator (e.g. activation rate) and a health metric (e.g. error rate < 1 %).
3. **Sketch the revenue/sustainability model.** One paragraph: how does this sustain itself
   (freemium, subscription, open-core, grant, internal tool, etc.)? No financial projections
   are required unless the human asks — just name the model.
4. **Identify top 3 risks** (pull from `product/market.md` `## Top risks`; update if needed). If
   **field validation** (interviews / a real preorder / a paid-ad demand test) has not been done, list
   *"real-customer demand unproven — field validation deferred"* as an explicit risk + assumption. Recommend
   field validation, but do **NOT** hard-block a resource-constrained founder; the go/no-go is their call.
5. **Draft `product/business-plan.md`** with sections:
   - `## MVP scope` — feature list + explicit non-goals
   - `## Success metrics` — primary + secondary + health
   - `## Revenue / sustainability model`
   - `## Top risks & mitigations`
   - `## Validation status` — desk demand verdict (from Phase 2) + field-validation status (done, or
     deferred with a logged assumption)
   - `## Go / No-go recommendation` — orchestrator's recommendation with reasoning (a valid verdict is
     **GO with field validation deferred** when desk demand is ≥ mixed and the human accepts the risk)
6. **HUMAN SIGN-OFF.** Present the plan to the user. Wait for explicit approval
   (`go`, `approved`, `proceed`, or equivalent). Do not advance on silence.
   Record the approval in `harness/state.yaml` under `phases.business_case.human_approved: true`.
7. **Advance.** Set `stage_status: gate_pending`; run the exit gate.
   On pass, write `gate: passed` and set `stage: tech_architecture`.

## Output artifacts

| File | Notes |
|---|---|
| `product/business-plan.md` | MVP scope, metrics, model, go/no-go |

## Exit gate checklist

- [ ] `product/business-plan.md` exists with all five sections
- [ ] MVP scope names features AND explicit non-goals
- [ ] At least one measurable, time-bound success metric is defined
- [ ] Revenue/sustainability model is named (one paragraph minimum)
- [ ] `## Validation status` present: desk demand verdict + field-validation status (done / deferred-with-assumption); founder not hard-walled
- [ ] Go/no-go recommendation is present with explicit reasoning
- [ ] Human sign-off is recorded (`human_approved: true` in `state.yaml`)
- [ ] Gate verdict written to `.harness/audits/gate-03.md`

## Recommended tier + agents

- **All steps + audit:** `orchestrate` (`midas-orchestrator`, `claude-opus-4-8`)
  This is one of the ~6 irreversible decisions; do not downgrade to build tier.
