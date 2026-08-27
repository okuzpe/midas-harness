# Rule: Hygiene & dead-flow sweep (always-on)

These rules apply from Phase 7 (Sprint Execution) onward and are re-audited each Phase 8. They
complement [`code-quality.md`](./code-quality.md) (no dead code in the diff) with **project-level**
hygiene: unreachable flows, ledger drift, and stale product docs. The mechanical pass is
`/midas-hygiene` (path-passes sweep scope `product` + optional lean); Phase 8 grades whether its
findings were resolved or consciously deferred.

> **Every item carries a `**CHECK:**`** — the concrete condition the Phase-8 audit evaluates: a
> command/grep where one exists, or a `manual:` observable when judgment is required (the auditor
> records pass/fail with the sweep record path, audit note, or `file:line` as evidence).

## When to sweep

- **Brownfield** (`paths.state` → `mode: brownfield`): run `/midas-hygiene` (product scope) before the
  **first** `/close-sprint` after adoption, and again before any sprint close that touched routes,
  navigation, or `{product}/features.json`.
- **Greenfield**: hygiene is **recommended** before `/close-sprint` when the sprint diff is large or
  added new routes/pages; not required if none was run — unless a prior sweep this cycle reported
  unresolved high-severity findings (see below).

## Checklist

### Sweep record (brownfield)
- [ ] Before closing a sprint on a brownfield project, a hygiene pass was run or consciously skipped.
      **CHECK:** `manual:` if `state.yaml` has `mode: brownfield`, either (a) a
      `{runs}/sweeps/sweep-NN.md` exists whose date falls within the active sprint window, or (b)
      `{runs}/audits/audit-NN.md` § hygiene records `sweep: skipped — <one-line reason>`. Neither
      is a fail on greenfield (`mode` absent or `greenfield`).

### Unresolved dead flows
- [ ] High-severity dead-flow and ledger-drift findings are not left silent at sprint close.
      **CHECK:** `manual:` read the latest `{runs}/sweeps/sweep-NN.md` for this sprint cycle (if
      any); if `MIDAS_SWEEP_RESULT` shows `dead_flows>0` or `ledger_drift>0`, the sprint audit must
      list each as **fixed**, **deferred** (with issue/owner), or **accepted** (with rationale). An
      unmentioned high-severity row is a fail.

### Ledger honesty
- [ ] `{product}/features.json` status/evidence matches observable behaviour for features touched this sprint.
      **CHECK:** `manual:` for each feature id touched in the sprint diff, `status: passing` rows
      carry non-empty `evidence` (test path, route, or verify record); `failing` rows are not
      contradicted by shipped code in the same diff without a recorded deferral.

### Playbook triggers
- [ ] No zombie playbooks — recipes whose `Trigger` never matches the codebase are flagged or retired.
      **CHECK:** `manual:` for each `{product}/playbooks/*.md` cited in the sprint or architecture,
      grep `<src-root>/` for the trigger predicate; a playbook with zero matches and no `## Retired` note in
      the sweep or audit is a warn (fail if the sprint added or edited that playbook without fixing
      the trigger).

### Stale product docs
- [ ] Open questions and doc links stay honest after the sprint.
      **CHECK:** `manual:` rows in `{product}/open-questions.md` marked OPEN that are answered in
      `{product}/idea.md` are a fail; internal markdown links in changed `{product}/*` files that 404 on
      disk are a fail (grep `](` targets against the tree).

### Aging knowledge (needs_review)
- [ ] Rules and playbooks that have gone long without an amendment are flagged, not silently trusted.
      **CHECK:** `manual:` when a `{runs}/sweeps/sweep-NN.md` exists for this cycle, every effective
      `<paths.rules>/*.md` and `{product}/playbooks/*.md` whose latest `## Amendment` date (or file
      mtime if no Amendment) is older than **180 days** appears as category `needs_review` (or is
      consciously accepted in the sweep Disposition). A sweep that ran `standard` depth and omitted
      such rows is a fail. Greenfield with no sweep this cycle → `n/a`.

## Relationship to other tools

| Tool | Role |
|---|---|
| `/midas-hygiene` | Primary orchestrator — product sweep + optional lean |
| `midas-sweep` (internal) | Produces `{runs}/sweeps/sweep-NN.md` (path-pass; prefer scope `product`) |
| `/midas-doctor` | Adapter/state sync — not a substitute for hygiene |
| `/close-sprint` | Grades this rule's CHECKs at Phase 8 (Step 0 path-passes hygiene) |
| `/midas-tribunal` | Strategic *decisions* audit — orthogonal to hygiene |

## Amendment

- **2026-08-27** — Gentleman Ch.20 aging: rules/playbooks without a fresh `## Amendment` for >180
  days surface as `needs_review` in sweep records (git-visible only; ADR-003).
- **2026-08-10** — Mechanical pass cited as `/midas-hygiene` (product scope); sweep `harness` remains
  power-user-only, not graded under this product-hygiene rule.
