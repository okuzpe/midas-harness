# Phase 4 — Tech Architecture

**Stage enum:** `tech_architecture` | **Tier:** orchestrate (decide)

## Purpose

Pin the technology stack with verifiable evidence, produce a system diagram, and
record every significant decision in an ADR. No code is written here — only decisions
that constrain Phase 7. Context7 is mandatory for all library choices.

## Inputs

- `product/business-plan.md` (Phase 3) — MVP scope and non-goals
- `harness/state.yaml` (stage must be `tech_architecture`)

## Key steps

1. **Derive requirements.** From MVP scope, list the non-negotiable technical requirements
   (e.g. auth, persistence, real-time, mobile, offline, scale target).
2. **Propose the stack.** For each requirement, select a library or service.
   For every third-party choice: call `resolve-library-id` then `get-library-docs`
   at the intended version via Context7 (scout tier). Confirm the API surface exists
   at that version before committing the choice. If Context7 is unavailable, use the
   web fallback per `harness/rules/context7-usage.md` and note it in the ADR.
3. **Write `product/architecture.md`.** Include:
   - `## Stack` — table: layer | choice | version | rationale
   - `## System diagram` — ASCII or Mermaid flowchart covering data flow end-to-end
   - `## Constraints` — hard limits derived from non-goals and business plan
   - `## Open decisions` — any choices deferred to a future sprint ADR
4. **Write ADRs.** One file per significant decision: `product/adr/ADR-001-<slug>.md`.
   Format: Status | Context | Decision | Consequences. At minimum, one ADR is required
   (e.g. the primary persistence layer or framework choice).
5. **Verify requirements coverage.** Map each requirement from step 1 to a stack entry.
   Unmet requirements block the gate.
6. **Advance.** Set `stage_status: gate_pending`; run the exit gate.
   On pass, write `gate: passed` and set `stage: architecture_rules`.

## Output artifacts

| File | Notes |
|---|---|
| `product/architecture.md` | Stack, diagram, constraints |
| `product/adr/ADR-NNN-<slug>.md` | One file per decision; at least one required |

## Exit gate checklist

- [ ] `product/architecture.md` exists with all four sections
- [ ] Every third-party library in the stack was verified via Context7 (or documented web fallback)
- [ ] System diagram covers the full data flow (not just the frontend)
- [ ] At least one ADR exists in `product/adr/`
- [ ] Every non-negotiable requirement from step 1 is covered by a stack entry
- [ ] No third-party API was coded from memory (Context7 or web fallback evidence present)
- [ ] Gate verdict written to `.harness/audits/audit-04.md`

## Recommended tier + agents

- **All steps + audit:** `orchestrate` (`midas-orchestrator`, `claude-opus-4-8`)
  Stack choice is an irreversible decision; Opus is required.
- **Context7 fetches:** `scout` (`midas-scout`, `claude-haiku-4-5`) — mechanical retrieval
