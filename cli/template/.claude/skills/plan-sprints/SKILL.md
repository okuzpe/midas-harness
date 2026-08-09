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

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Playbook:** `<paths.engine>/pipeline/6-sprint-planning.md`

Sequence the **MVP only** into shippable sprints. Value is correct decomposition and dependency
ordering, not prose volume. Each sprint is a thin, demonstrable slice whose Definition of Done points
at Phase-5 rules — that is what makes the Phase-8 audit possible.

> **Precondition.** Read **`paths.state`**. Run when `stage: architecture_rules` is `passed` (or
> `sprint_planning` resuming). If the rules/design system are not frozen, stop and report.

## Does / Does not

| Does | Does not |
|---|---|
| Plan **MVP-only** roadmap + per-sprint files with EARS acceptance + rule-named DoD | Pull non-goals into scope or invent post-MVP work |
| Keep sprint 1 independently shippable; prefer many thin sprints | Fat “kitchen-sink” sprints that absorb “just one more” feature |
| Seed `{product}/features.json` (`status: failing`) + `sprints[]` planned | Self-advance `stage` or start implementation (`/start-sprint` does that) |

## When NOT
- Rules/design system not frozen → `/define-conventions` first.
- Sprints already planned and you only need to kick off → `/start-sprint`.
- Mid-sprint task tracking → path-pass `midas-progress` (internal; replan only if the human explicitly asks).

**Anti-rationalization:** a sprint that keeps absorbing scope is a **fail** — split it. Do **not**
merge extras into sprint 1 so it stops being independently shippable. Soft target: **≤ 5 concrete
tasks** per sprint file unless the human accepts a written exception in the sprint’s non-scope notes.

## Inputs
- **`paths.state`**, `{product}/business-plan.md` (MVP scope + non-goals + success metrics),
  `{product}/architecture.md`, effective rules (`<paths.engine>/rules/*` + `<paths.rules>/*`),
  `{product}/design-system.md`.

## Procedure

### 1. Extract the MVP backlog
Capabilities required to hit business-case **success metrics** — nothing more. Non-goals stay out.
Every backlog item maps to a metric or a hard dependency.

### 2. Order by dependency, slice for shippability
Dependency graph (e.g. data/auth before features that need them). **Sprint 1** = independently
shippable vertical slice; later sprints depend only on earlier ones.

### 3. Write `{product}/roadmap.md`
Ordered sprint list: one-line goal each, explicit dependency order, mapping to success metrics. **MVP only**.

### 4. Write each `{product}/sprints/NN-<slug>.md`
Zero-padded, sequential. Each file:
- **Goal** — one sentence; demonstrable outcome.
- **Scope / non-scope** — in vs explicitly deferred.
- **Tasks** — ordered concrete units (soft cap ≤ 5 unless exception noted).
- **Acceptance criteria** — **EARS** (`WHEN <trigger>, the system SHALL <response>`; see
  `<paths.engine>/conventions.md` § Acceptance criteria), one behavior per line.
- **Definition of Done** — names frozen rules (folder-structure, conventions, testing,
  design-system token, Context7) + “acceptance met, tests pass”. Point at rules; do not restate them.

### 5. Seed `{product}/features.json`
From MVP scope via `<paths.engine>/templates/features.json.tmpl`. Each feature `status: failing`.
Phase 7 updates only `status` and `evidence`.

### 6. Record state
Read-modify-write **`paths.state`**: append `sprints[]` as `{ id, title, status: planned, audit_notes: "",
last_touched }`; list roadmap + sprint files + `features.json` in `phases.sprint_planning.artifacts`;
set `stage_status: gate_pending`. Do **not** self-advance the stage.

## Exit gate (orchestrate audits)
- [ ] `{product}/roadmap.md` is **MVP only** (every item → metric/dependency; nothing from non-goals).
- [ ] Each sprint has goal + scope + tasks + EARS acceptance + DoD naming frozen rules.
- [ ] Sprints are dependency-ordered; **sprint 1 is independently shippable**.
- [ ] Soft task cap honored or exception noted in non-scope.
- [ ] `{product}/features.json` seeded (every feature `status: failing`).
- [ ] `sprints[]` in `paths.state` each `status: planned`.

On pass: freeze `{runs}/audits/gate-06.md` from `<paths.engine>/templates/gate-record.md`, set gate passed; next **`/start-sprint`** on sprint 1.
On fail: name the under-specified sprint or broken ordering.

## Tier & cost
Decomposition / ordering / acceptance design → **orchestrate** (`midas-orchestrator`). Draft sprint
markdown → **build** (`midas-builder`) after the plan is fixed. No Context7 (no third-party code yet).
