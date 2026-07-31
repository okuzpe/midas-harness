---
name: idea-intake
description: "Phase 0 of Midas — capture the raw product idea verbatim, normalize it into {product}/idea.md with a one-line pitch and mode, and initialize/advance **`paths.state`**. Use to start a new product or record its founding idea."
metadata:
  midas-disable-model-invocation: true
  midas-harness-tier: orchestrate
  midas-model: inherit
  midas-recommended-model: claude-opus-4-8
  midas-user-invocable: true
---
# idea-intake — Phase 0: capture the idea

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read the state file at **`paths.state`** (`layout` + `paths` block, or infer from disk). If the precondition stage is wrong, report and stop.

> **Paths:** Engine = `<paths.engine>/`; scripts = `<paths.scripts>/`; `{runs}/` = `paths.runs`. See `AGENTS.md` § Path resolution.

Phase 0 turns a raw, possibly messy idea into a normalized, preserved artifact so the rest of the
pipeline has a stable starting point. **Preservation is sacred:** never rewrite the user's words away —
capture them verbatim, then add a normalized layer beside them. Playbook: `<paths.engine>/pipeline/0-idea-intake.md`.

**Precondition:** **`paths.state`** exists at `stage: idea_intake` (set by `/midas-init`). Read it
first; if Midas is not initialized, direct the user to `/midas-init`. Read first, write last.

## Does / Does not

| Does | Does not |
|---|---|
| Preserve raw idea **verbatim** + add a normalized pitch beside it | Rewrite or “improve” the user's words in the raw block |
| Confirm `mode` (`greenfield` \| `brownfield`) with the user | Invent audience/metric/non-goals the user never stated |
| Advance Phase-0 artifacts in `paths.state` (write last) | Run market/arch work or skip to later phases |

## When NOT
- Idea already captured and Phase 0 gate passed → next is `/contextualize`, not a re-run.
- Repo has substantial existing code and no Midas state → `/midas-adopt` (or `/midas-init`).
- User only wants orientation → `/midas-status` / `/midas-help`.

**Anti-rationalization:** do **not** skip verbatim capture because the idea “sounds simple”; do **not**
infer `mode` without confirming; mark inferences as **assumption**, never as fact.

## Steps

1. **Capture verbatim.** Ask for the idea in their own words (or take what they already gave). Store
   the raw text **unedited** in `{product}/idea.md` under `"Raw idea (as given)"`. Append-only —
   later phases never overwrite it.
2. **Normalize** beside the raw capture (`<paths.engine>/templates/` → `{product}/idea.md`):
   - **one-line pitch** (≤ 20 words) a stranger could understand;
   - apparent **user/audience**, **problem**, **hoped-for outcome** (rough OK — Phase 1 sharpens);
   - **non-goals** the user already named.
3. **Confirm the mode.** Default from `paths.state → mode`. Confirm via `AskUserQuestion`
   (`greenfield` \| `brownfield`); if changed, record the correction.
4. **Advance state (write last).** Read-modify-write **`paths.state`**: list `{product}/idea.md` under
   `phases.idea_intake.artifacts`; set `mode` if confirmed/changed; refresh `updated`.

## Exit gate (Phase 0)

Advance to Phase 1 **iff** all hold (on-disk evidence):

- [ ] Raw idea preserved verbatim in `{product}/idea.md` (`Raw idea (as given)`).
- [ ] One-line pitch ≤ 20 words present.
- [ ] `mode` is `greenfield` \| `brownfield` in `paths.state` (user-confirmed).
- [ ] Inferred fields (if any) marked **assumption**, not fact.

On pass: set `phases.idea_intake` to `{ status: passed, gate: passed }`, set
`stage: contextualize, stage_status: not_started`, next action **`/contextualize`**.
On miss: keep `stage_status: in_progress` and name exactly what is outstanding.
Producer never grades its own homework — the gate verdict is the orchestrator's.

## Tier & delegation
- **Dispatch + gate verdict:** `orchestrate` → `midas-orchestrator`.
- **Write `{product}/idea.md` and update `paths.state`:** `build` → `midas-builder`.
- Scout is read-only; do not assign file writes to `midas-scout`.
