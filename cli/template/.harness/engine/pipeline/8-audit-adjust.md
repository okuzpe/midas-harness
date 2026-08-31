# Phase 8 — Per-Sprint Audit & Adjust

**Phase ledger:** `audit` (runs during `sprint_execution`; top-level `stage` stays `sprint_execution`) | **Tier:** orchestrate (audit)

> Canonical procedure for `/close-sprint`. Shared fragments:
> `<paths.engine>/templates/audit-checklists.md`. Record shape:
> `<paths.engine>/templates/audit-record.md`. Hygiene:
> `<paths.engine>/rules/hygiene.md`.

## Purpose

The orchestrator audits the completed sprint against the Phase 5 rules and the MVP scope,
fixes or consciously amends any drift, and decides whether to loop back for the next sprint
or declare the MVP complete. The producer never grades its own work.

## Inputs

- Active `{product}/sprints/NN-*.md` (work landed: tasks done, tests run; UI `/midas-verify` green when applicable)
- `<paths.engine>/rules/*` plus `<paths.rules>/*` (project slug wins)
- `{product}/architecture.md`, `{product}/idea.md`, `{product}/conventions.md`,
  `{product}/design-system.md`, `{product}/design-direction.md`, `{product}/business-plan.md`
- `paths.state` (`stage: sprint_execution`; Phase 8 runs in place)
- When `track: lite`, `{product}/market.md` is **optional** — do not fail the audit for its
  absence. `{product}/design-system.md` and `{product}/design-direction.md` are optional when
  the sprint does not touch UI (record `n/a` in the audit). `{product}/business-plan.md` is still
  required (lite stub counts). See `<paths.engine>/pipeline/lite.md`.

## Key steps

### 0. Hygiene pass

Read `paths.state` → `mode`. **Brownfield:** a sweep record for this sprint cycle is
**required** unless the audit documents `sweep: skipped — <reason>`. **Greenfield:** sweep is
recommended on large diffs; not blocking if none was run and no prior sweep left unresolved
high-severity findings. Prefer **path-pass** `<paths.engine>/skills/midas-hygiene/SKILL.md` (product scope; path-passes
sweep `product` + lean on fat diffs) inside `/close-sprint` — do not Skill-tool invoke. When a
sweep exists, resolve or consciously defer every `dead-flow` and `ledger-drift` row before grading
other rules.

### 0.5. Diff gate receipts (production diffs)

When the working diff touches **production** paths (see `scripts/gates/lib/diff-paths.mjs` and ADR-012 §4),
require passing receipts under `{paths.cache}/gates/<run>/test.json` and `quality.json` (`isPassingReceipt`
semantics) **or** record an explicit skip with reason in `{runs}/sprints/NN-progress.md` or audit notes.
When receipts are missing or stale (`changed_paths` no longer matches the diff), **path-pass**
`<paths.engine>/skills/midas-diff-gates/SKILL.md` in this close run. Engine-only / docs-only diffs: skip OK.
UI/API proof remains `/midas-verify` — gate receipts do not replace it.

### 1. Load state + frozen rules

Load the inputs above. Design-direction named UI references are the evidence the
`accessibility.md` design-fidelity CHECK grades against.

### 2. Conformance audit (every rule, pass/fail, with evidence)

For **each** effective base/project rule and the design-system token rule, evaluate the rule's CHECK
against the sprint diff and render **pass/fail with on-disk evidence** (file:line). Confirm
third-party code was written against Context7-verified docs at the pinned version.

Where a task followed a `{product}/playbooks/*` recipe, confirm its **done-when** checks hold —
and **trigger-check every playbook**: if the sprint diff matches a playbook's `Trigger` predicate,
its done-when MUST be satisfied even if the author did not consciously "follow" it. No rule is
skipped; "not applicable this sprint" is itself a recorded verdict.

### 3. Scope audit vs the business case

Confirm delivered scope matches the plan and advances a business-case success metric, and that
nothing from **non-goals** crept in.

### 4. Resolve drift

For every failed check or scope mismatch, choose **one** and record it:

- **Fix now** — queue/apply the correction, or
- **Consciously amend the rule** — update `<paths.rules>/` overlay (+ ADR if architectural) with
  logged rationale and re-render adapters (`/midas-doctor` / `render-adapters.mjs`).

Classify findings as `conformance-fix` | `rule-amendment` | `scope-drift`. After any rule
amendment, re-audit affected checks. Drift is never left silent.

### 5. Freeze the audit

Write `{runs}/audits/audit-NN.md` (NN = sprint id) from
`<paths.engine>/templates/audit-record.md`: keep those headings (`## Verdict tally`, `## Artifacts`,
`## Per-rule results`, `## Scope reconciliation`, `## Hygiene`, `## Amendments`). Gate-parseable tally,
**Artifacts** table (every claimed path exists on disk — see `phase-result.md`), per-rule table with
evidence, scope reconciliation, hygiene (sweep path or `sweep: skipped — reason`), drift resolutions,
overall verdict. A `verdict=pass` with an empty Artifacts table or a missing path is a fail.
Tally shape (also in `audit-checklists.md`):

```
MIDAS_AUDIT_RESULT: rules_failed=X unresolved=Y amended=Z verdict=pass|blocked
```

`unresolved` = fails neither fixed nor consciously amended. **Close only when `unresolved=0` and
`verdict=pass`** — doctor flags a blocked tally paired with `status: done`.

### 6. Plan adjustment + update state

Read-modify-write `paths.state`: sprint `status: done`, `audit_notes`, `last_touched`, `last_audit`,
reconcile remaining `sprints[]`. In the same step, set the matching `{product}/roadmap.md` **Status**
cell for that sprint id to `done` (when the file exists). Canonical status stays `paths.state`; the
roadmap table is the human-readable copy. Then **select next**:

- **Next sprint remains** → `stage: sprint_execution`, `stage_status: not_started`; next =
  `/start-sprint`.
- **No sprints left AND success metrics met** → `stage: shipped` ("MVP complete"). Optional
  `/midas-tribunal` (pre-ship) — never forced.
- **Metrics unmet and no sprints** → surface the gap to the human before deciding.

### Risk-selected lenses

During Step 2, select review lenses by diff **signal** — do not run every lens on a rename.
Canonical table and CHECKs: `<paths.engine>/rules/verification.md` § Risk-selected review lenses
(4R: security / maintainability / reliability / resilience). Short map:

| Signal | Lenses | Skip |
|---|---|---|
| Docs-only, rename, comment | Maintainability optional | Security audit not required |
| Mutating shell, infra, retries, queues | Reliability + resilience | — |
| Auth, payments, secrets, or **>400** authored production lines | All four (parallel where read-only) | Documented skip with reason only |

Cite which lenses ran (or a dated skip) in `{runs}/audits/audit-NN.md`. When two independent lenses
disagree, synthesize per verification.md (`confirmed` / `suspect` / `escalate`).

## Output artifacts

| File | Notes |
|---|---|
| `{runs}/audits/audit-NN.md` | Tally, Artifacts paths, rule verdicts, fixes, amendments |
| `<paths.rules>/<slug>.md` | Overlay + dated `## Amendment` if an effective rule changed |

## Exit gate checklist

- [ ] Every effective rule has a verdict (pass / fail / n/a) with evidence
- [ ] Playbook triggers honored when the diff matches a `Trigger`
- [ ] All `fail` verdicts fixed or consciously amended (logged)
- [ ] Scope reconciled against the business case
- [ ] `{runs}/audits/audit-NN.md` frozen with `verdict=pass`
- [ ] `paths.state` updated; `{product}/roadmap.md` Status for the closed sprint is `done`; clear next step (next sprint or MVP complete)

## Recommended tier + agents

- **Audit + decide:** `orchestrate` (`midas-orchestrator`) — irreversible gate; do not downgrade
- **Mechanical diff extraction:** `scout`
- **Conformance fixes:** `build` tier, then re-run `/close-sprint` until `unresolved=0`; next sprint
  kickoff is `/start-sprint` only after Step 6 marks the current sprint `done`
- Prefer an installed code-review/security specialist if present; otherwise `midas-orchestrator`
