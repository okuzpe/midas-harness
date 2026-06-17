<!-- Phase 6 / 7 — Sprint artifact. Created by /start-sprint (Phase 6 planning → Phase 7 execution).
     Filed as product/sprints/NN-<slug>.md (zero-padded sprint number, kebab slug).
     Exit gate (Phase 7): tasks done, acceptance criteria met, tests pass, DoD satisfied.
     Phase 8 audit checks DoD conformance against harness/rules/* (do not self-grade). -->

# Sprint {{SPRINT_NUMBER}} — {{SPRINT_TITLE}}

| Field | Value |
|---|---|
| **Sprint number** | {{SPRINT_NUMBER}} |
| **Status** | <!-- planned \| active \| blocked \| done --> |
| **Started** | <!-- YYYY-MM-DD --> |
| **Target close** | <!-- YYYY-MM-DD --> |
| **Depends on** | <!-- sprint numbers or "none" --> |

## Goal

<!-- TODO: one sentence — what user-facing outcome does this sprint deliver? -->

…

## Acceptance criteria

<!-- TODO: testable, binary criteria — each item must be verifiably true when sprint closes.
     Write in EARS form: "WHEN <trigger>, the system SHALL <response>" (or "The system SHALL …").
     One observable behaviour per line. The Phase 8 audit checks each with on-disk evidence. -->

- [ ] WHEN …, the system SHALL …
- [ ] WHEN …, the system SHALL …
- [ ] The system SHALL …

## Definition of Done (DoD)

<!-- TODO: sprint-specific checklist referencing the rules that apply.
     Standard items below — add stack-specific items from harness/rules/. -->

- [ ] All acceptance criteria above are met.
- [ ] Every changed behaviour has a passing automated test (`harness/rules/testing-*.md`).
- [ ] No lint errors or type errors (`harness/rules/code-quality-*.md`).
- [ ] Code reviewed (at least one other agent tier or human).
- [ ] No new hardcoded colours/spacing/type sizes (design-system rule).
- [ ] Context7 was used for every new third-party API touched (`harness/rules/context7-usage.md`).
- [ ] `harness/state.yaml` updated (`stage_status: gate_pending` when last task done).
- [ ] <!-- TODO: add stack / feature -specific DoD items -->

## Tasks

<!-- TODO: break down the goal into implementation tasks. Each task: title, owner tier, status.
     If a task follows a product/playbooks/* recipe, note it as `playbook: <slug>` so the Phase 8
     audit can confirm that playbook's done-when checks. -->

| # | Task | Tier | Status | Notes |
|---|---|---|---|---|
| 1 | … | build | todo | … |
| 2 | … | build | todo | … |
| 3 | … | scout | todo | … |

## Blockers

<!-- TODO: updated during sprint — any impediment preventing progress -->

- …

## Phase 8 audit notes

<!-- Filled by the orchestrator after /close-sprint; not by the builder during execution. -->

- **Audit file:** `.harness/audits/audit-{{SPRINT_NUMBER}}.md`
- **Verdict:** <!-- pending \| pass \| fail -->
- **Drift items:** <!-- none \| list -->
- **Next action:** <!-- start-sprint NN \| fix drift \| MVP complete -->
