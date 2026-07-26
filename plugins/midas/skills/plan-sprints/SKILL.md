---
name: plan-sprints
description: Phase 6 — decompose the MVP scope into a dependency-ordered roadmap and per-sprint plans, each with goal, scope, tasks, acceptance criteria, and a DoD that references the frozen rules. Use after conventions and the design system are frozen (stage architecture_rules → sprint_planning), before any sprint executes.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
---

# plan-sprints (Phase 6 — Sprint Planning)

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read the state file at **`paths.state`** (`layout` + `paths` block, or infer from disk). If the precondition stage is wrong, report and stop.

> **Paths:** Engine = `<paths.engine>/`; scripts = `<paths.scripts>/`; `{runs}/` = `paths.runs`. See `AGENTS.md` § Path resolution.

Sequence the **MVP only** into shippable sprints. This is an **orchestrate-tier** decision: the value
is in correct decomposition and dependency ordering, not in prose volume. Each sprint must be a thin,
demonstrable slice whose Definition of Done points back at the Phase-5 rules — that is what makes the
Phase-8 audit possible.

> **Precondition.** Read **`paths.state`**. Run when `stage: architecture_rules` is `passed` (or
> `sprint_planning` resuming). If the rules/design system are not frozen, stop and report — sprints
> whose DoD references rules cannot exist before the rules do.

## Inputs
- **`paths.state`**, `{product}/business-plan.md` (MVP scope + non-goals + success metrics),
  `{product}/architecture.md`, the effective rules from `<paths.engine>/rules/*` plus `<paths.rules>/*`,
  `{product}/design-system.md`.

## Procedure

### 1. Extract the MVP backlog
List the capabilities required to hit the business-case **success metrics** — and nothing more.
Anything in non-goals stays out. Reconcile every backlog item to a metric or a hard dependency.

### 2. Order by dependency, slice for shippability
Build a dependency graph (e.g. data/auth before features that need them). Group items into sprints so
that **sprint 1 is independently shippable** (a vertical slice that runs and demonstrates value), and
each later sprint depends only on earlier ones. Keep sprints small; prefer more thin sprints over a
few fat ones.

### 3. Write `{product}/roadmap.md`
The ordered sprint list with each sprint's one-line goal, the dependency order made explicit, and a
mapping from sprints to the success metrics they advance. The roadmap covers **MVP only**.

### 4. Write each `{product}/sprints/NN-<slug>.md`
Zero-padded, sequential. Each sprint file contains:
- **Goal** — one sentence; the demonstrable outcome.
- **Scope / non-scope** — what is in, what is explicitly deferred.
- **Tasks** — ordered, concrete units of work.
- **Acceptance criteria** — observable, testable conditions that prove the goal is met. Write them in
  **EARS** form (`WHEN <trigger>, the system SHALL <response>`; see `<paths.engine>/conventions.md` §
  Acceptance criteria), one behavior per line, so Phase 8 can map each to a passing test.
- **Definition of Done** — references the **frozen rules** by name (folder-structure, conventions,
  testing rule, design-system token rule, Context7 rule) plus "acceptance criteria met, tests pass".
  The DoD is what Phase 8 audits, so it must point at checkable rules, not restate them.

### 5. Seed `{product}/features.json`
From MVP scope in `{product}/business-plan.md`, create one entry per MVP feature using
`<paths.engine>/templates/features.json.tmpl`. Each feature starts with `status: failing`. Phase 7 updates
only `status` and `evidence` as work lands.

### 6. Record state
Update **`paths.state`** (read-modify-write): append the planned sprints to `sprints[]` (each `{ id, title, status:
planned, audit_notes: "", last_touched }`), list roadmap + sprint files + `{product}/features.json` in
`phases.sprint_planning.artifacts`, set `stage_status: gate_pending`. Do not self-advance the stage.

## Exit gate (orchestrate audits)
- `{product}/roadmap.md` covers **MVP only** (every item traces to a metric/dependency; nothing from
  non-goals).
- Each sprint has **goal + scope + tasks + acceptance criteria + DoD**, and the **DoD references the
  frozen rules**.
- Sprints are **dependency-ordered** and **sprint 1 is shippable**.
- `{product}/features.json` seeded from MVP scope (every feature `status: failing`).
- `sprints[]` is set in `paths.state` (each `status: planned`).

On pass: freeze the verdict in `{runs}/audits/gate-06.md`, set the gate passed; next action is `/start-sprint`
(Phase 7) on sprint 1. On fail: report the under-specified sprint or broken ordering.

## Tier & cost
Decomposition, ordering, and acceptance/DoD design → **orchestrate** (`midas-orchestrator`). Drafting the sprint
markdown → **build** (`midas-builder`) once the orchestrator has fixed the plan. No Context7 needed
here (no third-party code written yet).
