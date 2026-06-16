# Tribunal debate-01 — scope: whole-project — depth: tribunal
Convened: 2026-06-16 · Judge: midas-orchestrator (claude-opus-4-8) · cost_profile: balanced

> Example output of `/midas-tribunal` on the TaskPilot product. Every claim cites a real line in the
> example artifacts. Frozen and immutable, mirroring `.harness/audits/audit-NN.md`.

## Verdict tally
UPHELD: 1 (CRIT 1 · HIGH 0 · MED 0)  ·  REJECTED: 1  ·  UNPROVEN: 1  ·  DISSENTS: 1
MIDAS_TRIBUNAL_RESULT: criticals=1 highs=0

## Ranked findings  (severity × confidence)

| ID | Lens | Severity | Conf | Claim | Evidence (path / file:line) | Verdict | Action |
|----|------|----------|------|-------|-----------------------------|---------|--------|
| T-01 | Reliability/FMEA + Security/STRIDE | CRIT | verified | Multi-tenant isolation is a convention, not an enforced control — one forgotten `WHERE workspace_id=` leaks every team's data | `architecture.md:63`; `business-plan.md:65`; `harness/rules/security.md` | upheld | fix |
| T-02 | Economist/Unit-Economics | HIGH | speculative | The path from 10 free pilots to ~50 *paying* workspaces is unsupported | `business-plan.md:56`, `:57-58`, `:66` | unproven | defer |
| T-03 | Simplifier/YAGNI | LOW | verified | Scope discipline: the non-goals list is genuinely tight | `business-plan.md:26-40` | rejected | accept-with-rationale |

## Minority / dissent
- **T-02 (Catfish):** maintains this should be **HIGH-blocking before any go/no-go**, not deferred —
  "a free pilot that never tests willingness-to-pay validates the wrong hypothesis." The judge ruled
  UNPROVEN (the gap is real but *consciously deferred* and logged, so not a hidden defect). Recorded,
  not dropped.

## Recommended actions (findings → action bridge)
- **T-01 fix** → add a Phase-5 *checkable* rule (DB row-level security, or a query-builder guard that
  injects `workspace_id`) + a cross-tenant isolation test; surface as a task at the next `/start-sprint`.
- **T-02 defer** → append `OQ-07` to `product/open-questions.md`: "validated path from free pilot to
  ~50 paying workspaces (willingness-to-pay signal)"; non-blocking, revisit before the Phase-3 v2 GO.

## Full transcript (appendix)

### T-01 · Multi-tenant isolation
- **Defense (steelman):** "Isolation is documented: a `workspace_id` column on every table and *all
  queries scoped by workspace from session* (`architecture.md:63`); `harness/rules/security.md` already
  mandates boundary validation. Postgres 17 makes row-level security straightforward (`architecture.md:13`)."
- **Prosecution:** "Documented ≠ enforced. The control is *application-convention* scoping
  (`architecture.md:63`), with no row-level security and no DB-enforced tenant guard. FMEA: severity
  CRITICAL, **detection LOW** — it passes every test and is invisible until a cross-tenant leak in prod.
  STRIDE (Information Disclosure) at the DB trust boundary."
- **Catfish:** "Both sides cite the *same* line. The Defense's 'scoped from session' is the very thing
  the Prosecution says isn't enforced. Where is the build-failing CHECK? There isn't one."
- **Judge (Opus):** **UPHELD · CRIT · verified.** Re-read `architecture.md:63` in fresh context: scoping
  is advisory, not enforced; the business case even assumes a single shared Postgres instance
  (`business-plan.md:65`), so all tenants share one DB with only a column guard. Action: **fix**.

### T-02 · Unit economics
- **Prosecution:** "Break-even is '~50 paying workspaces (5 members avg)' at '$6/user/month'
  (`business-plan.md:57-58`), but the pilot is free for only 10 workspaces (`business-plan.md:56`) with
  *no paid acquisition* (`business-plan.md:66`). The path from 10 free to 50 paying is unsupported."
- **Defense:** "v1 is explicitly validation-only; pricing 'will not be built into v1'
  (`business-plan.md:59`) and conversion is a deferred v2 concern."
- **Judge:** **UNPROVEN · HIGH · speculative.** The gap is real but *consciously deferred and logged*,
  so it is not a hidden defect — it is a known open question. Action: **defer** (with dissent recorded).

### T-03 · Scope (YAGNI)
- **Prosecution:** "Looking for scope creep…" — found none material.
- **Judge:** **REJECTED.** The non-goals list (`business-plan.md:26-40`) is explicit and disciplined
  (file attachments, SSO, notifications, native apps, analytics all deferred). Honest "nothing material
  found" for this lens. Action: accept-with-rationale.

---
_Not theater: 1 of 3 lenses produced a material, evidence-cited finding routed to a fix; 1 was deferred
with logged dissent; 1 returned an honest clean verdict. Total seats: 6 (3 lenses × Defense/Prosecution)
+ 1 Catfish + 1 Opus judge._
