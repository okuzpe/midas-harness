# Phase 0 — Idea Intake

**Stage enum:** `idea_intake` | **Tier:** orchestrate (dispatch) + scout (produce)

## Purpose

Capture the raw idea before any analysis distorts it, establish the one-line pitch,
and seed `harness/state.yaml` so every subsequent phase has a baseline to build on.
This is the cheapest phase; speed matters more than depth.

## Inputs

- User's raw prompt, voice note, or description (any form)
- Nothing else — no prior artifacts required

## Key steps

1. **Record verbatim.** Write the raw idea into `product/idea.md` under a `## Raw idea` heading.
   Do not paraphrase or improve it yet.
2. **Derive a 1-line pitch.** Synthesize a single sentence: `<verb> <for whom> <so that <outcome>>`.
   Append it to `product/idea.md` under `## One-line pitch`.
3. **Identify mode.** Ask: is this greenfield (empty repo) or brownfield (existing code)?
   Record `mode: greenfield|brownfield` in `harness/state.yaml`.
4. **Seed state.** Create or overwrite `harness/state.yaml` with the schema from
   `harness/state.schema.md`: set `stage: idea_intake`, `stage_status: in_progress`,
   `entry_stage: idea_intake`, and an empty `phases` ledger.
5. **Advance.** Set `stage_status: gate_pending`; run the exit gate below.
   On pass, write `gate: passed` and set `stage: contextualize` to trigger Phase 1.

## Output artifacts

| File | Notes |
|---|---|
| `product/idea.md` | Raw idea + 1-line pitch |
| `harness/state.yaml` | Seeded with mode, stage, routing |

## Exit gate checklist

- [ ] `product/idea.md` exists and contains an unedited `## Raw idea` section
- [ ] `## One-line pitch` is present and fits one sentence
- [ ] `mode` is set (`greenfield` or `brownfield`) in `harness/state.yaml`
- [ ] `harness/state.yaml` is valid against `harness/state.schema.md`
- [ ] Gate verdict written to `.harness/audits/gate-00.md`

## Recommended tier + agents

- **Dispatch/audit:** `orchestrate` (`midas-orchestrator`, `claude-opus-4-8`)
- **Write artifacts:** `build` (`midas-builder`, `claude-sonnet-4-6`) — scout is read-only
