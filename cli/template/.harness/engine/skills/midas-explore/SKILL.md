---
name: midas-explore
description: Ad-hoc investigation outside the 9-phase pipeline — notes under {runs}/explore/<slug>/. Use for debugging or scoping that is not a phase gate or sprint task; close with --end.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: scout
recommended-model: claude-haiku-4-5
argument-hint: "[topic] | --end [--no-capture]"
---

# midas-explore — investigation outside the pipeline

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> Read **`paths.state`** first when checking sprint conflicts.

> **Paths:** `{runs}/` → `paths.runs`. Sessions live at `{runs}/explore/<slug>/` (optional dir, like
> `{runs}/qa/` — **not** in `RUNS_SUBDIRS`). Active pointer: `{runs}/explore/.active` (slug text).
> Git-visible only (ADR-003). Never advances `stage` or sprint gates.

## Does / Does not

| Does | Does not |
|---|---|
| Append notes across turns | Replace `/start-sprint` or phase skills |
| Fetch/read sources the user names | Write product rules silently |
| Propose `/midas-capture` on `--end` | Touch `paths.state` phase fields |

## Activation

At turn start, if `{runs}/explore/.active` exists and the user did **not** invoke `/midas-explore`
or `--end`, run **Carryover only** (below). Otherwise load this full skill on explicit invoke.

## Carryover (active session, normal user message)

1. Read `{runs}/explore/<slug>/meta.yaml` + `notes.md` (slug from `.active`).
2. Append under `## Notes (chronological)`:
   `- [HH:MM] **User**: <summary>` / `- [HH:MM] **Agent**: <understanding + plan>`
3. Route into Open questions / Hypotheses / Actionable items / Sources as needed.
4. Bump `turn_count` and `last_activity` in `meta.yaml`.
5. Reply to the user's question — do not re-dump the whole skill.

## Start — `/midas-explore [topic]`

1. **Conflict:** if `paths.state` has a sprint `status: active`, AskQuestion once:
   - "Keep sprint; cancel explore" (default)
   - "Start explore anyway (sprint stays active; do not implement sprint tasks here)"
2. If `.active` already set → AskQuestion: close existing (`--end --no-capture`) and start new, or cancel.
3. **Slug:** kebab-case from topic (max 5 words); on collision append `-2`, `-3`.
4. Create `{runs}/explore/<slug>/` from `<paths.engine>/templates/explore-meta.yaml` + `explore-notes.md`.
5. Write slug to `{runs}/explore/.active`.
6. **Optional — lifecycle journal:** `node <paths.scripts>/lifecycle-journal.mjs explore_start --detail "<slug>"` (fail-open).
7. Confirm in ≤5 lines: slug, path, how to end (`/midas-explore --end`).

## End — `/midas-explore --end`

1. Set `status: completed` in `meta.yaml`; delete `.active` (or clear it).
2. **Optional — lifecycle journal:** `node <paths.scripts>/lifecycle-journal.mjs explore_end --detail "<slug>"` (fail-open).
3. Summarize Actionable items (≤10 lines).
4. Unless `--no-capture`: if items look like a durable rule/playbook/convention, **propose**
   `/midas-capture` (recommend-don't-wall — ask first, never write the artifact here).

## When NOT

- Ticketed/sprint work → `/start-sprint` / Phase 7.
- Need pipeline PC only → `/midas-status`.
- Need a one-shot context pack → `/midas-recall`.

## Exit gate
- [ ] **Start:** `{runs}/explore/<slug>/` exists, `.active` points at slug, user knows `/midas-explore --end`.
- [ ] **End:** `meta.yaml` `status: completed`, `.active` cleared; Actionable summary printed.
- [ ] No `stage` / gate advances; durable patterns only **proposed** via `/midas-capture` (not written here).
- [ ] Carryover turns append notes without re-dumping this skill.

## Tier & delegation
- **Dispatch:** `scout` → `midas-scout` for indexing; session may write explore notes under `{runs}/explore/` as build-tier file I/O when starting/ending a session.
- Classification / capture proposals stay recommend-don't-wall — escalate durable writes to `/midas-capture` (`build`), never invent a gate verdict.
- Respect `cost_profile`.
