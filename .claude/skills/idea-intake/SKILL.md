---
name: idea-intake
description: Phase 0 of Keel — capture the raw product idea verbatim, normalize it into product/idea.md with a one-line pitch and mode, and initialize/advance harness/state.yaml. Use to start a new product or record its founding idea.
user-invocable: true
disable-model-invocation: false
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
---

# idea-intake — Phase 0: capture the idea

Phase 0 turns a raw, possibly messy idea into a normalized, preserved artifact so the rest of the
pipeline has a stable starting point. **Preservation is sacred:** never rewrite the user's words away —
capture them verbatim, then add a normalized layer beside them. Playbook: `harness/pipeline/00-idea-intake.md`.

**Precondition:** `harness/state.yaml` exists at `stage: idea_intake` (set by `/keel-init`). Read it
first; if Keel is not initialized, direct the user to `/keel-init`. Read first, write last.

## Steps

1. **Capture verbatim.** Ask the user for their idea in their own words (or take what they already
   gave). Store the raw text **unedited** in `product/idea.md` under a clearly labeled "Raw idea (as
   given)" section. This block is append-only history — later phases never overwrite it.
2. **Normalize** beside the raw capture, using the `product/idea.md` template from `harness/templates/`:
   - a **one-line pitch** (≤ ~20 words) that a stranger could understand;
   - the apparent **user/audience**, **problem**, and **hoped-for outcome** as currently understood
     (rough is fine — Phase 1 sharpens these via the gap loop);
   - obvious **non-goals** the user has already named.
   Mark anything you inferred as an assumption, not a fact — do not invent specifics the user didn't give.
3. **Confirm the mode.** Default from `state.yaml -> mode` (`greenfield` | `brownfield`). Confirm with
   the user; if it changed, record the correction.
4. **Advance state (write last).** Read-modify-write the whole `harness/state.yaml`:
   - record `product/idea.md` under `phases.idea_intake.artifacts`;
   - set `mode` if it was confirmed/changed; refresh `updated`.

## Exit gate (Phase 0)

The orchestrator advances to Phase 1 **iff** all hold, with on-disk evidence:

- the **raw idea is preserved verbatim** in `product/idea.md`;
- a **one-line pitch** exists;
- the **mode is set** (`greenfield` | `brownfield`) in `state.yaml`.

When satisfied, set `phases.idea_intake` to `{ status: passed, gate: passed }`, set `stage:
contextualize, stage_status: not_started`, and tell the user the next action is **`/contextualize`**.
If any item is missing, keep `stage_status: in_progress` and report exactly what is outstanding.
Producer never grades its own homework — the gate verdict is the orchestrator's to render.
