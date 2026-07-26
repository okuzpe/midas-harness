# Phase 8 — Per-Sprint Audit & Adjust

**Phase ledger:** `audit` (runs during `sprint_execution`; top-level `stage` stays `sprint_execution`) | **Tier:** orchestrate (audit)

## Purpose

The orchestrator audits the completed sprint against the Phase 5 rules and the MVP scope,
fixes or consciously amends any drift, and decides whether to loop back for the next sprint
or declare the MVP complete. The producer never grades its own work.

## Inputs

- Completed sprint file `{product}/sprints/NN-<slug>.md` (Phase 7, status `done`)
- `<paths.engine>/rules/*` plus `<paths.rules>/*` (project overlays frozen; amendments require a logged decision)
- `{product}/business-plan.md` (Phase 3 — scope reference)
- `paths.state` (stage `sprint_execution`, the active sprint's work landed — Phase 8 runs in place)

## Key steps

### Optional hygiene (recommended)
Before the conformance audit, consider `/midas-sweep` (especially after a large sprint or brownfield
work). It surfaces dead routes, orphan modules, and `features.json` drift so Phase 8 does not waste
cycles on cruft. **Brownfield** (`mode: brownfield`): a sweep record or documented skip is **required**
— graded by [`hygiene.md`](../rules/hygiene.md) at close. Greenfield: recommended, not blocking unless
a prior sweep left unresolved high-severity findings.

### Re-audit / apply-harness loop

1. **Run every rule check.** For each effective rule after merging base and project rules by slug, execute the stated
   verification command or grep pattern against the new code. Record each rule as
   `pass`, `fail`, or `n/a` with evidence (file:line or test name).
2. **Scope reconciliation.** Verify that no code added in this sprint implements a
   feature outside MVP scope (`{product}/business-plan.md § MVP scope`). Flag any drift.
3. **Classify findings.**
   - `conformance-fix` — code violates a rule; the code must change, not the rule.
   - `rule-amendment` — the rule was wrong or the context changed; update the rule file
     with a dated `## Amendment` section and a one-line rationale. Never silent.
   - `scope-drift` — feature outside MVP; revert or defer to a post-MVP sprint.
4. **Apply fixes.** For each conformance-fix, the orchestrator (or delegated build agent)
   corrects the code and re-runs the relevant rule check before continuing.
5. **Re-run amended rules.** After any rule amendment, re-audit the entire sprint against
   the updated rule to confirm nothing else is affected.
6. **Write `{runs}/audits/audit-NN.md`.** One file per sprint audit. Include:
   - Sprint ID + title
   - The **gate-parseable tally line** (mirrors `MIDAS_VERIFY_RESULT` / `MIDAS_TRIBUNAL_RESULT`)
     so a script — not just a model — can read the verdict:
     ```
     MIDAS_AUDIT_RESULT: rules_failed=X unresolved=Y amended=Z verdict=pass|blocked
     ```
     `unresolved` counts fails neither fixed nor consciously amended; a `pass` verdict **requires
     `unresolved=0`**. `/midas-doctor` reads this line and warns if a frozen record shows
     `unresolved>0` (or `verdict=blocked`) while `paths.state` marks that sprint done.
   - Rule-by-rule verdict table: rule | result | evidence
   - Scope reconciliation verdict
   - List of fixes applied (or "none")
   - List of rule amendments (or "none") with rationale
   - Final verdict: `pass` or `blocked`
7. **Decide next action.**
   - If sprints remain and MVP metrics are not yet met: set the next sprint to `active`
     in `paths.state`, set `stage: sprint_execution`, and loop to Phase 7.
   - If no sprints remain AND success metrics from Phase 3 are met: set `stage: shipped`.
   - If metrics are not met and no sprints remain: surface the gap to the human before deciding.

## Output artifacts

| File | Notes |
|---|---|
| `{runs}/audits/audit-NN.md` | Rule verdicts, fixes, amendments, final verdict |
| `<paths.rules>/<slug>.md` | Project overlay updated with `## Amendment` if an effective rule changed |

## Exit gate checklist

- [ ] Every effective base or project rule has a verdict (pass / fail / n/a) with evidence
- [ ] All `fail` verdicts are resolved: either code fixed or rule consciously amended (logged)
- [ ] No scope drift remains (or explicit deferral decision is recorded)
- [ ] `{runs}/audits/audit-NN.md` exists with a final verdict of `pass`
- [ ] `paths.state` updated: sprint closed, next stage set (`sprint_execution` or `shipped`)
- [ ] Any rule amendment includes a dated rationale in the rule file itself

## Recommended tier + agents

- **Audit + decide:** `orchestrate` (`midas-orchestrator`, `claude-opus-4-8`)
  This is one of the ~6 irreversible decisions; do not downgrade.
- **Apply conformance fixes:** `build` (`midas-builder`, `claude-sonnet-4-6`)
