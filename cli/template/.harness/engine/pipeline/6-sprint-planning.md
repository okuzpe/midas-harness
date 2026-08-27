# Phase 6 — Sprint Planning

**Stage enum:** `sprint_planning` | **Tier:** orchestrate (sequence)

## Purpose

Decompose the MVP scope (from Phase 3) into an ordered set of sprints, each with a
clear goal, acceptance criteria, and Definition of Done that references the Phase 5 rules.
Sprints cover MVP only — no scope creep. Dependencies must be ordered.

## Inputs

- `{product}/business-plan.md` (Phase 3) — MVP scope and non-goals
- `<paths.engine>/rules/*` plus `<paths.rules>/*` (Phase 5 overlays) — DoD references the combined rules
- `paths.state` (stage must be `sprint_planning`)
- When `track: lite`, `{product}/market.md` is **optional** — do not hard-stop if it is missing.
  `{product}/business-plan.md` is still required (Lite writes a thin stub). See
  `<paths.engine>/pipeline/lite.md`.

## Key steps

0. **Optional hygiene (recommended when brownfield or the codebase grew during prior phases).**
   Run `/midas-sweep docs` or `/midas-sweep all` to reconcile `{product}/features.json` candidates,
   stale open questions, and roadmap rows with what exists on disk — so Sprint 01 is planned against
   reality, not ghosts. Non-blocking.

1. **List all MVP tasks.** Extract every feature in MVP scope as a discrete task.
   Anything outside MVP scope is explicitly excluded with a note.
2. **Group into sprints.** Cluster tasks by dependency order and logical cohesion.
   Each sprint should be completable in a focused session (or a defined time-box if
   the human specifies one). Sprint 01 must be independently runnable (no hard deps on
   later sprints). Name them zero-padded: `01`, `02`, …
3. **Write `{product}/roadmap.md`.** A table: sprint | goal | key tasks | depends-on.
   The goal row must fit one sentence.
4. **Write one sprint file per sprint: `{product}/sprints/NN-<slug>.md`.**
   Each file must include:
   - `## Goal` — one sentence
   - `## Tasks` — checkbox list of concrete tasks
   - `## Acceptance criteria` — observable behaviors that prove the sprint is done
   - `## Definition of Done` — references at least one applicable base or project rule;
     must include: tests pass, conventions followed, no new lint/rule violations
5. **Seed `{product}/features.json`.** From MVP scope in `business-plan.md`, create one entry per MVP
   feature using `<paths.engine>/templates/features.json.tmpl`. Each feature starts `status: failing`.
   Phase 7 flips only `status` and `evidence` as work lands.
6. **Register sprints in `paths.state`.** Append each sprint to the `sprints:` list
   with `status: planned`.
7. **Advance.** Set `stage_status: gate_pending`; run the exit gate.
   On pass, write `gate: passed` and set `stage: sprint_execution`, `stage_status: not_started`.
   Sprint activation happens in `/start-sprint` (Phase 7).

## Output artifacts

| File | Notes |
|---|---|
| `{product}/roadmap.md` | Full MVP sprint table |
| `{product}/sprints/NN-<slug>.md` | One file per sprint |
| `{product}/features.json` | MVP feature ledger (seeded from business-plan scope) |

## Exit gate checklist

- [ ] `{product}/roadmap.md` covers all MVP features from `business-plan.md`
- [ ] No non-MVP feature appears in any sprint file
- [ ] Each sprint file has Goal, Tasks, Acceptance criteria, and Definition of Done
- [ ] Each DoD references at least one rule file by name from the combined rule set
- [ ] Sprint dependencies are ordered (Sprint N does not depend on Sprint N+1)
- [ ] Sprint 01 is independently runnable (no external sprint dependencies)
- [ ] All sprints registered in `paths.state` under `sprints:` (each `status: planned`)
- [ ] `{product}/features.json` seeded from MVP scope; every MVP feature has an entry with `status: failing`
- [ ] Gate verdict written to `{runs}/audits/gate-06.md` (seed: `templates/gate-record.md`)

## Recommended tier + agents

- **Sequence + audit:** `orchestrate` (`midas-orchestrator`, `claude-opus-4-8`)
- **Write sprint files:** `build` (`midas-builder`, `claude-sonnet-4-6`)
