# Phase 0 — Idea Intake

**Stage enum:** `idea_intake` | **Tier:** orchestrate (dispatch) + scout (produce)

## Purpose

Capture the raw idea before any analysis distorts it, establish the one-line pitch,
and seed `paths.state` so every subsequent phase has a baseline to build on.
This is the cheapest phase; speed matters more than depth.

## Inputs

- User's raw prompt, voice note, or description (any form)
- Nothing else — no prior artifacts required

## Key steps

1. **Record verbatim.** Write the raw idea into `{product}/idea.md` under a `## Raw idea (preserved verbatim)` heading.
   Do not paraphrase or improve it yet.
2. **Derive a 1-line pitch.** Synthesize a single sentence: `<verb> <for whom> <so that <outcome>>`.
   Append it to `{product}/idea.md` under `## 1-line pitch`.
3. **Identify mode.** Confirm via `AskQuestion`: is this greenfield (empty repo) or brownfield
   (existing code)? Record `mode: greenfield|brownfield` in `paths.state`.
4. **Advance state (write last).** `paths.state` already exists from `/midas-init`. Read-modify-write
   only this phase: list `{product}/idea.md` under `phases.idea_intake.artifacts`; set `mode` if
   confirmed/changed; refresh `updated`. Do not create a blank ledger or overwrite routing/tools.
5. **Advance.** Set `stage_status: gate_pending`; run the exit gate below.
   On pass, freeze `{runs}/audits/gate-00.md`, write `gate: passed`, and set `stage: contextualize`.

## Output artifacts

| File | Notes |
|---|---|
| `{product}/idea.md` | Raw idea + 1-line pitch |
| `{runs}/audits/gate-00.md` | Phase-0 gate freeze |
| `paths.state` | Seeded with mode, stage, routing |

## Exit gate checklist

- [ ] `{product}/idea.md` exists and contains an unedited `## Raw idea (preserved verbatim)` section
- [ ] `## 1-line pitch` is present and fits one sentence
- [ ] `mode` is set (`greenfield` or `brownfield`) in `paths.state`
- [ ] `paths.state` is valid against `<paths.engine>/state.schema.md`
- [ ] Gate verdict written to `{runs}/audits/gate-00.md`

## Recommended tier + agents

- **Dispatch/audit:** `orchestrate` (`midas-orchestrator`, `claude-opus-4-8`)
- **Write artifacts:** `build` (`midas-builder`, `claude-sonnet-4-6`) — scout is read-only
