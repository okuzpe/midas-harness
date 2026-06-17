---
name: plan-sprints
description: Phase 6 — decompose the MVP scope into a dependency-ordered roadmap and per-sprint plans, each with goal, scope, tasks, acceptance criteria, and a DoD that references the frozen rules. Use after conventions and the design system are frozen (stage architecture_rules → sprint_planning), before any sprint executes.
user-invocable: true
disable-model-invocation: false
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
---

# plan-sprints (Phase 6 — Sprint Planning)

Sequence the **MVP only** into shippable sprints. This is an **orchestrate-tier** decision: the value
is in correct decomposition and dependency ordering, not in prose volume. Each sprint must be a thin,
demonstrable slice whose Definition of Done points back at the Phase-5 rules — that is what makes the
Phase-8 audit possible.

> **Precondition.** Read `harness/state.yaml`. Run when `stage: architecture_rules` is `passed` (or
> `sprint_planning` resuming). If the rules/design system are not frozen, stop and report — sprints
> whose DoD references rules cannot exist before the rules do.

## Inputs
- `harness/state.yaml`, `product/business-plan.md` (MVP scope + non-goals + success metrics),
  `product/architecture.md`, `harness/rules/*`, `product/design-system.md`.

## Procedure

### 1. Extract the MVP backlog
List the capabilities required to hit the business-case **success metrics** — and nothing more.
Anything in non-goals stays out. Reconcile every backlog item to a metric or a hard dependency.

### 2. Order by dependency, slice for shippability
Build a dependency graph (e.g. data/auth before features that need them). Group items into sprints so
that **sprint 1 is independently shippable** (a vertical slice that runs and demonstrates value), and
each later sprint depends only on earlier ones. Keep sprints small; prefer more thin sprints over a
few fat ones.

### 3. Write `product/roadmap.md`
The ordered sprint list with each sprint's one-line goal, the dependency order made explicit, and a
mapping from sprints to the success metrics they advance. The roadmap covers **MVP only**.

### 4. Write each `product/sprints/NN-<slug>.md`
Zero-padded, sequential. Each sprint file contains:
- **Goal** — one sentence; the demonstrable outcome.
- **Scope / non-scope** — what is in, what is explicitly deferred.
- **Tasks** — ordered, concrete units of work.
- **Acceptance criteria** — observable, testable conditions that prove the goal is met. Write them in
  **EARS** form (`WHEN <trigger>, the system SHALL <response>`; see `harness/conventions.md` §
  Acceptance criteria), one behavior per line, so Phase 8 can map each to a passing test.
- **Definition of Done** — references the **frozen rules** by name (folder-structure, conventions,
  testing rule, design-system token rule, Context7 rule) plus "acceptance criteria met, tests pass".
  The DoD is what Phase 8 audits, so it must point at checkable rules, not restate them.

### 5. Record state
Update `harness/state.yaml`: append the planned sprints to `sprints[]` (each `{ id, title, status:
planned, audit_notes: "", last_touched }`), list roadmap + sprint files in
`phases.sprint_planning.artifacts`, set `stage_status: gate_pending`. Do not self-advance the stage.

## Exit gate (orchestrate audits)
- `product/roadmap.md` covers **MVP only** (every item traces to a metric/dependency; nothing from
  non-goals).
- Each sprint has **goal + scope + tasks + acceptance criteria + DoD**, and the **DoD references the
  frozen rules**.
- Sprints are **dependency-ordered** and **sprint 1 is shippable**.
- `sprints[]` is set in `state.yaml`.

On pass: freeze the verdict in `.harness/audits/`, set the gate passed; next action is `/start-sprint`
(Phase 7) on sprint 1. On fail: report the under-specified sprint or broken ordering.

## Tier & cost
Decomposition, ordering, and acceptance/DoD design → **orchestrate** (Opus). Drafting the sprint
markdown can route to **build** (Sonnet) once the orchestrator has fixed the plan. No Context7 needed
here (no third-party code written yet).
