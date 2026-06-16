# Phase 8 — Per-Sprint Audit & Adjust

**Stage enum:** `audit` | **Tier:** orchestrate (audit)

## Purpose

The orchestrator audits the completed sprint against the Phase 5 rules and the MVP scope,
fixes or consciously amends any drift, and decides whether to loop back for the next sprint
or declare the MVP complete. The producer never grades its own work.

## Inputs

- Completed sprint file `product/sprints/NN-<slug>.md` (Phase 7, status `done`)
- `harness/rules/*` (Phase 5 — frozen; amendments require a logged decision)
- `product/business-plan.md` (Phase 3 — scope reference)
- `harness/state.yaml` (stage must be `audit`)

## Key steps

### Re-audit / apply-harness loop

1. **Run every rule check.** For each file in `harness/rules/`, execute the stated
   verification command or grep pattern against the new code. Record each rule as
   `pass`, `fail`, or `n/a` with evidence (file:line or test name).
2. **Scope reconciliation.** Verify that no code added in this sprint implements a
   feature outside MVP scope (`product/business-plan.md § MVP scope`). Flag any drift.
3. **Classify findings.**
   - `conformance-fix` — code violates a rule; the code must change, not the rule.
   - `rule-amendment` — the rule was wrong or the context changed; update the rule file
     with a dated `## Amendment` section and a one-line rationale. Never silent.
   - `scope-drift` — feature outside MVP; revert or defer to a post-MVP sprint.
4. **Apply fixes.** For each conformance-fix, the orchestrator (or delegated build agent)
   corrects the code and re-runs the relevant rule check before continuing.
5. **Re-run amended rules.** After any rule amendment, re-audit the entire sprint against
   the updated rule to confirm nothing else is affected.
6. **Write `.harness/audits/audit-NN.md`.** One file per sprint audit. Include:
   - Sprint ID + title
   - Rule-by-rule verdict table: rule | result | evidence
   - Scope reconciliation verdict
   - List of fixes applied (or "none")
   - List of rule amendments (or "none") with rationale
   - Final verdict: `pass` or `blocked`
7. **Decide next action.**
   - If sprints remain and MVP metrics are not yet met: set the next sprint to `active`
     in `state.yaml`, set `stage: sprint_execution`, and loop to Phase 7.
   - If no sprints remain AND success metrics from Phase 3 are met: set `stage: shipped`.
   - If metrics are not met and no sprints remain: surface the gap to the human before deciding.

## Output artifacts

| File | Notes |
|---|---|
| `.harness/audits/audit-NN.md` | Rule verdicts, fixes, amendments, final verdict |
| `harness/rules/<slug>.md` | Updated with `## Amendment` section if a rule changed |

## Exit gate checklist

- [ ] Every rule in `harness/rules/` has a verdict (pass / fail / n/a) with evidence
- [ ] All `fail` verdicts are resolved: either code fixed or rule consciously amended (logged)
- [ ] No scope drift remains (or explicit deferral decision is recorded)
- [ ] `.harness/audits/audit-NN.md` exists with a final verdict of `pass`
- [ ] `harness/state.yaml` updated: sprint closed, next stage set (`sprint_execution` or `shipped`)
- [ ] Any rule amendment includes a dated rationale in the rule file itself

## Recommended tier + agents

- **Audit + decide:** `orchestrate` (`keel-orchestrator`, `claude-opus-4-8`)
  This is one of the ~6 irreversible decisions; do not downgrade.
- **Apply conformance fixes:** `build` (`keel-builder`, `claude-sonnet-4-6`)
