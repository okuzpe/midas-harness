---
name: midas-retro
description: "Read-only sprint retrospective — freeze learnings under {runs}/retros/retro-NN.md without advancing stage. Use after a sprint closes or when the team wants a gstack-/reflect-style note. Complements /close-sprint (conformance) and /midas-progress (STM)."
metadata:
  midas-argument-hint: "[NN|latest] [--dry-run]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-retro — sprint retrospective (non-advancing)

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> No stage precondition — runs anytime. Never mutates `paths.state` stage/gates.
> Template: `<paths.engine>/templates/retro-record.md` → `{runs}/retros/retro-NN.md`.

Standing **retrospective note** (not a phase gate): capture what went well, what hurt, and durable
takeaways after a sprint. Distinct from `/close-sprint` (rule conformance + scope audit) and
`/midas-progress` (during-sprint STM rows).

## Does / Does not

| Does | Does not |
|---|---|
| Freeze `{runs}/retros/retro-NN.md` with learnings table | Advance `stage` or pass Phase-8 gates |
| Read sprint file, progress STM, latest audit/verify | Rewrite architecture, rules, or `features.json` |
| Emit `MIDAS_RETRO_RESULT` tally | Replace `/close-sprint`, `/midas-tribunal`, or `/midas-capture` |

## Args

| Arg | Meaning |
|---|---|
| `NN` | Sprint id (e.g. `01`, `02`) |
| `latest` (default) | Most recently `done` sprint, else `active`, else highest planned with a file |
| `--dry-run` | Print the draft in chat only — do not write the freeze file |

## Procedure

### 1. Read state + pick sprint (scout)
Read **`paths.state`**. Resolve `{runs}/` and `{product}/`. Choose sprint id from args / `sprints[]`.
Require `{product}/sprints/NN-*.md` on disk. If missing → stop and name the path.

Dispatch **scout** for an index pack (paths + short excerpts, not whole trees):

- Sprint file: Goal, Acceptance, Tasks status, Blockers
- `{runs}/sprints/NN-progress.md` § Done / Learned (if present)
- Latest `{runs}/audits/audit-NN.md` / `{runs}/verifications/verify-NN.md` when they exist
- Open rows in `{product}/open-questions.md` touched this sprint (if any)

### 2. Draft the retro (build)
Fill sections from the template:

| Section | Content |
|---|---|
| **Went well** | 3–7 concrete wins with evidence (`path` or test id) |
| **Hurt** | Friction, false starts, missing proof — no blame |
| **Learned** | Durable takeaways (candidates for `/midas-capture` if recurring) |
| **Carry forward** | Unfinished work / next-sprint inputs (not new scope invention) |

Keep the whole record ≤ ~120 lines. Prefer tables over prose.

### 3. Freeze (unless `--dry-run`)
Allocate next `retro-NN` under `{runs}/retros/` (monotonic; independent of sprint id).
Write the file. Print path + one-line summary. Emit:

```
MIDAS_RETRO_RESULT: sprint=NN went_well=N hurt=N learned=N carry=N verdict=frozen|dry-run
```

`verdict=frozen` only when the file exists on disk. Never set `gate: passed`.

### 4. Optional capture handoff
If ≥2 Learned rows look like durable rules/playbooks, **propose** `/midas-capture` (recommend-don't-wall) — do not write those artifacts here.

## Exit gate
- [ ] Sprint source file resolved; user told which sprint was retrospected.
- [ ] `--dry-run` → no write; otherwise `{runs}/retros/retro-NN.md` exists with tally line.
- [ ] `paths.state` stage/gates untouched.
- [ ] No silent rule/playbook writes.

## Tier & delegation
- **Dispatch + freeze write:** `build` → `midas-builder`.
- **Index pack (sprint/progress/audit excerpts):** `scout` → `midas-scout`.
- No orchestrate gate verdict. Respect `cost_profile`.

## When NOT
- Conformance / scope audit → `/close-sprint`.
- Mid-sprint STM row only → path-pass `midas-progress` (internal).
- Dead flows / ledger drift → path-pass `midas-sweep` (internal).
- Decision quality debate → `/midas-tribunal`.
