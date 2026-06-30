---
name: close-sprint
description: Phase 8 — per-sprint conformance and scope audit. Diff the code against every frozen rule (pass/fail with evidence), reconcile scope vs the business case, resolve drift, freeze .harness/audits/audit-NN.md, update state, and select the next sprint or declare MVP complete. Use after a sprint's work lands (stage stays `sprint_execution`; Phase 8 runs in place).
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
---

# close-sprint (Phase 8 — Per-sprint Audit & Adjust)

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read `harness/state.yaml`; if the precondition stage is wrong, report and stop.

The closing half of the **7 ⇄ 8 loop**. After a sprint's code lands, the orchestrator audits the
**living code** against the **rules frozen in Phase 5** and the **scope in the business case**,
resolves drift, freezes the verdict, and decides what's next. The **producer never grades its own
homework** — this is an independent orchestrate-tier audit.

> **Precondition.** A sprint must be `active` in `state.yaml.sprints[]` with its work landed (tasks
> done, tests run). If no active sprint, stop and report.

## Procedure

### 0. Hygiene pass (`harness/rules/hygiene.md`)
Read `harness/state.yaml` → `mode`. **Brownfield:** a `/midas-sweep` record for this sprint cycle is
**required** unless the audit documents `sweep: skipped — <reason>`. **Greenfield:** sweep is
recommended on large diffs; not blocking if none was run and no prior sweep left unresolved
high-severity findings. When a sweep exists, resolve or consciously defer every `dead-flow` and
`ledger-drift` row before grading other rules — otherwise Phase 8 audits noise.

### 1. Read state + frozen rules
Load `harness/state.yaml`, the active `product/sprints/NN-*.md`, all `harness/rules/*`,
`product/architecture.md` and `product/idea.md` (the module boundaries + glossary the
code-quality/testing/security/naming CHECKs grade against), `product/conventions.md`,
`product/design-system.md`, `product/design-direction.md` (the named UI references — the evidence the
`accessibility.md` design-fidelity CHECK grades against), and `product/business-plan.md`.

### 2. Conformance audit (every rule, pass/fail, with evidence)
For **each** rule in `harness/rules/*` and the design-system token rule, evaluate the rule's CHECK
against the sprint diff and render **pass/fail with on-disk evidence** (file:line). Confirm
third-party code was written against Context7-verified docs at the pinned version. Where a task
followed a `product/playbooks/*` recipe, confirm its **done-when** checks hold too — and **trigger-check
every playbook**: if the sprint diff matches a playbook's `Trigger` predicate, its done-when MUST be
satisfied even if the author did not consciously "follow" it (a recurring task done the wrong way is a
fail). No rule is skipped; "not applicable this sprint" is itself a recorded verdict.

### 3. Scope audit vs the business case
Confirm the sprint's delivered scope matches its plan and advances a business-case success metric, and
that nothing from **non-goals** crept in (no scope creep, no silently dropped must-have).

### 4. Resolve drift
For every failed check or scope mismatch, choose **one** and record it:
- **Fix now** — queue/apply the correction to restore conformance, or
- **Consciously amend the rule** — if the rule is wrong, update `harness/rules/` (+ ADR if
  architectural) with a logged rationale and re-render adapters (`node scripts/render-adapters.mjs` /
  `/midas-doctor`).

Drift is never left silent: the sprint closes only when every fail is fixed or every amendment logged.

### 5. Freeze the audit
Write `.harness/audits/audit-NN.md` (NN = sprint id): a **gate-parseable tally line**, the per-rule
pass/fail table with evidence, the scope reconciliation, a **§ Hygiene** subsection (sweep record
path, or `sweep: skipped — reason`; deferred dead-flow rows), the drift resolutions/amendments, and the
overall verdict. This file is the immutable record of the sprint gate. The tally line mirrors
verify/tribunal so `/midas-doctor` can read the verdict without a model:

```
MIDAS_AUDIT_RESULT: rules_failed=X unresolved=Y amended=Z verdict=pass|blocked
```

`unresolved` counts fails neither fixed nor consciously amended. **Close the sprint only when
`unresolved=0` and `verdict=pass`** — a blocked or unresolved tally must not be paired with a
`status: done` sprint in `state.yaml` (doctor flags that mismatch).

### 6. Plan adjustment + update state
Update `harness/state.yaml`: set the sprint `status: done`, write its `audit_notes`, refresh
`last_touched`, set `last_audit`, and reconcile remaining `sprints[]` (re-order/insert if the audit
revealed new work). Then **select next**:
- **Next sprint remains** → set `stage: sprint_execution`, `stage_status: not_started` on it; the next
  action is `/start-sprint`.
- **No sprints left AND success metrics met** → set `stage: shipped`. Declare **"MVP complete"**.
  **Recommended optional checkpoint:** a `/midas-tribunal` (the *pre-ship* audit) before declaring complete —
  "were the decisions right, now that it's built?" Optional, the human's call; never block on it.

## Exit gate
- **Every rule audited** pass/fail **with evidence**.
- **Playbook triggers honored:** any diff matching a `product/playbooks/*` `Trigger` shows that
  playbook's done-when satisfied (a matching change that bypassed the playbook is a fail).
- **Drift fixed or the rule consciously amended** (logged) — nothing silent.
- **Scope reconciled** against the business case.
- `.harness/audits/audit-NN.md` frozen; `state.yaml` updated.
- A clear next step: **next sprint** or **"MVP complete"**.

## Tier & cost
The audit, drift decisions, and ship/continue call → **orchestrate** (Opus). Mechanical diff
extraction → **scout** (Haiku). Any fix work routes to **build** (Sonnet) under the next
`/start-sprint`. Prefer an installed code-review/security specialist
(`voltagent-qa-sec:code-reviewer`/`security-auditor`, `/code-review`) if present; otherwise
`midas-orchestrator`.
