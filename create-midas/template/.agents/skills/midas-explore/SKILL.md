---
name: midas-explore
description: "Ad-hoc investigation outside the 9-phase pipeline — notes under {runs}/explore/<slug>/. Use for debugging or scoping that is not a phase gate or sprint task; close with --end."
metadata:
  midas-argument-hint: "[topic] | --end [--no-capture]"
  midas-disable-model-invocation: true
  midas-harness-tier: scout
  midas-model: inherit
  midas-recommended-model: claude-haiku-4-5
  midas-user-invocable: true
---
# midas-explore — investigation outside the pipeline

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
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
6. Confirm in ≤5 lines: slug, path, how to end (`/midas-explore --end`).

## End — `/midas-explore --end`

1. Set `status: completed` in `meta.yaml`; delete `.active` (or clear it).
2. Summarize Actionable items (≤10 lines).
3. Unless `--no-capture`: if items look like a durable rule/playbook/convention, **propose**
   `/midas-capture` (recommend-don't-wall — ask first, never write the artifact here).

## When NOT

- Ticketed/sprint work → `/start-sprint` / Phase 7.
- Need pipeline PC only → `/midas-status`.
- Need a one-shot context pack → `/midas-recall`.
