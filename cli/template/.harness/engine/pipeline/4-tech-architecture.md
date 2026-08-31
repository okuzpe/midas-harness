# Phase 4 — Tech Architecture

**Stage enum:** `tech_architecture` | **Tier:** orchestrate (decide)

## Purpose

Pin the technology stack with verifiable evidence, produce a system diagram, and
record every significant decision in an ADR. No code is written here — only decisions
that constrain Phase 7. Fetching current docs before pinning any library is mandatory (Context7 recommended, or your own doc tool).

## Inputs

- `{product}/business-plan.md` (Phase 3) — MVP scope and non-goals
- `paths.state` (stage must be `tech_architecture`)

## Key steps

1. **Derive requirements + the macro-pattern forks.** From MVP scope, list the non-negotiable technical
   requirements (e.g. auth, persistence, real-time, mobile, offline, scale target). **Also name the 3–5
   hardest-to-reverse macro forks** as business/control trade-offs: **app shape** (one full-stack codebase
   vs decoupled frontend + backend API), **auth strategy** (framework-native/SDK vs a dedicated provider/
   auth-API vs a BFF holding tokens server-side), and **vendor lock-in** (how coupled to one platform/BaaS/
   IDaaS, and the migration cost). 2026 default is monolith-first + built-in auth; decoupling/dedicated auth
   are evidence-driven graduations.
2. **Propose the stack.** For each requirement, select a library or service.
   For every third-party choice: call `resolve-library-id` then `get-library-docs`
   at the intended version via Context7 (scout tier). Confirm the API surface exists
   at that version before committing the choice. If Context7 is unavailable, use the
   web fallback per `<paths.engine>/rules/context7-usage.md` and note it in the ADR.
3. **Recommend the industry standard, then ask the user — macro forks FIRST.** Ask the macro-pattern
   forks (app shape, auth strategy, lock-in) BEFORE framework-per-layer, in **plain founder-facing
   language** tied to a business trade-off (e.g. *"login inside our app — we own it, fastest — or a
   dedicated provider with a vendor dependency? Who logs in, will we sell to enterprises?"*). Then, for each
   consequential layer, name the current industry-standard default (grounded in current docs, not memory)
   and **ask via `AskQuestion`** — recommended option marked, one-line trade-off each. No preference →
   use the recommendation (never block); an override is the user's call, recorded in that decision's ADR.
   Only the chosen options get version-pinned. Keep it to the few decisions that truly matter.
4. **Write `{product}/architecture.md`** from `<paths.engine>/templates/architecture.md`. Headings
   are those of the template — not a parallel outline:
   - `## System overview`
   - `## Client` — surface type + verify tool (drives `/midas-verify --scope`)
   - `## Architecture diagram` — Mermaid (or ASCII) covering data flow end-to-end
   - `## Stack decisions` — table: layer | technology | version | ADR | Context7 verified
   - `## Requirements coverage` — each Step-1 requirement → component
   - `## Non-functional requirements`
   - `## Open technical risks`
   - `## ADR index`
5. **Write ADRs.** One file per significant decision: `{product}/adr/ADR-NNN-<slug>.md` from
   `<paths.engine>/templates/ADR.md` (`## Context`, `## Decision`, `## Considered alternatives`,
   `## Consequences`). At minimum, one ADR is required. **Each macro-pattern fork (app shape, auth
   strategy, lock-in) gets its own ADR** recording the choice/default + the coupling-vs-control trade-off.
6. **Verify requirements coverage.** Map each requirement from step 1 to a stack entry.
   Unmet requirements block the gate.
7. **Advance.** Set `stage_status: gate_pending`; run the exit gate.
   On pass, write `gate: passed` and set `stage: architecture_rules`.

## Output artifacts

| File | Notes |
|---|---|
| `{product}/architecture.md` | Stack, diagram, constraints |
| `{product}/adr/ADR-NNN-<slug>.md` | One file per decision; at least one required |
| `{runs}/audits/gate-04.md` | Phase-4 gate freeze |

## Exit gate checklist

- [ ] `{product}/architecture.md` exists with the template headings (`## System overview`, `## Client`,
      `## Architecture diagram`, `## Stack decisions`, `## Requirements coverage`,
      `## Non-functional requirements`, `## Open technical risks`, `## ADR index`)
- [ ] Each macro architecture pattern (app shape, auth strategy, lock-in) was surfaced to the human in plain language and its choice/default + trade-off recorded in its own ADR
- [ ] The consequential stack choices were recommended (industry standard) and put to the user; the selection (or explicit "use the recommendation") is recorded, overrides noted in the ADR
- [ ] Every third-party library in the stack was verified via Context7 (or documented web fallback)
- [ ] System diagram covers the full data flow (not just the frontend)
- [ ] At least one ADR exists in `{product}/adr/`
- [ ] Every non-negotiable requirement from step 1 is covered by a stack entry
- [ ] If the client includes **native or hybrid mobile**, `architecture.md` § Client names the verify tool (Maestro MCP / agent-browser) and emulator/simulator prerequisites
- [ ] No third-party API was coded from memory (Context7 or web fallback evidence present)
- [ ] Gate verdict written to `{runs}/audits/gate-04.md`

## Recommended tier + agents

- **All steps + audit:** `orchestrate` (`midas-orchestrator`, `claude-opus-4-8`)
  Stack choice is an irreversible decision; Opus is required.
- **Context7 fetches:** `scout` (`midas-scout`, `claude-haiku-4-5`) — mechanical retrieval
