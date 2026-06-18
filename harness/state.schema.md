# `harness/state.yaml` — State Schema (the spine)

`harness/state.yaml` is the **single source of truth** for where a project is in the Midas
lifecycle. Every Midas skill **reads it first and writes it last**. There is exactly one state
file, one path, one format (YAML). Do not introduce a second state model.

It is committed to the project's git (reproducible memory). Volatile caches/hashes are gitignored.

## Stage enum (maps 1:1 to the 9 phases)

| `stage` value | Phase | Done when (gate) |
|---|---|---|
| `idea_intake` | 0 | raw idea preserved, 1-line pitch, mode set |
| `contextualize` | 1 | 0 blocking open questions |
| `market_research` | 2 | ≥3 competitors, cited claims |
| `business_case` | 3 | MVP scope + metrics + go/no-go + human sign-off |
| `tech_architecture` | 4 | stack pinned (Context7-verified), ADRs written |
| `architecture_rules` | 5 | rules + design system, every rule checkable, adapters rendered |
| `sprint_planning` | 6 | roadmap covers MVP, each sprint has DoD |
| `sprint_execution` | 7 | active sprint tasks done, tests pass |
| `audit` | 8 | conformance audit frozen, drift resolved — Phase 8 runs **in place** during `sprint_execution`. The top-level `stage` is **never set to `audit`**; the `phases.audit` ledger entry and `last_audit.phase: audit` legitimately *name* the phase (that is fine). |
| `shipped` | — | no sprints left + success metrics met |

`stage` advances **only** after the orchestrator (Opus) writes a passing gate audit. The *initial* `stage`
is set by `/midas-init` from the project's maturity (E0–E3, see `harness/methodology.md`), with
`stage_status: not_started` and a recorded assumption per skipped gate; gate-only advancement governs every
transition after that.

## Schema

```yaml
midas_version: 0.5.10          # engine version that wrote this file (for /midas-update)
name: taskpilot              # project slug
mode: greenfield             # greenfield | brownfield  (maturity: E0/E1 → greenfield, E2/E3 → brownfield)
language: en                 # artifact language
created: 2026-06-16          # ISO date (set by /midas-init; never use a live clock in scripts)
updated: 2026-06-16
setup_complete: false        # the installer writes false; /midas-init flips it true when setup is done

stage: tech_architecture     # current stage enum (see table)
stage_status: in_progress    # not_started | in_progress | gate_pending | passed
entry_stage: idea_intake     # where this project entered (honesty for skipped gates)

cost_profile: balanced       # balanced | max_savings | max_quality
routing:                     # resolved model ids for this profile (see docs/agents-and-models.md)
  orchestrate: claude-opus-4-8
  build:       claude-sonnet-4-6
  scout:       claude-haiku-4-5

tools: [claude-code, cursor]        # which tools adapters were generated for
mcp:   [context7, sequential-thinking]   # which MCP servers are wired

# Per-phase ledger. artifacts = files that must exist for the gate to pass.
phases:
  idea_intake:       { status: passed, gate: passed, artifacts: [product/idea.md] }
  contextualize:     { status: passed, gate: passed, artifacts: [product/idea.md, product/open-questions.md] }
  tech_architecture: { status: in_progress, gate: pending, artifacts: [product/architecture.md] }

sprints:                     # appended during sprint planning; updated each cycle
  - id: "01"
    title: "Auth + task CRUD"
    status: active           # planned | active | blocked | done
    audit_notes: ""
    last_touched: 2026-06-16

last_audit: { phase: contextualize, verdict: pass, at: 2026-06-15 }
last_tribunal: { n: "01", criticals: 0, at: 2026-06-15 }      # optional — written by /midas-tribunal (informational only; never advances a gate)
last_verification: { n: "01", fails: 0, at: 2026-06-15 }      # optional — written by /midas-verify (informational only; never advances a gate)
last_security: { n: "01", critical: 0, high: 0, at: 2026-06-15 } # optional — written by /midas-security-audit (informational only; never advances a gate)
```

## Rules for consumers

1. **Read-modify-write the whole file**; never keep a partial in-memory copy across a phase.
2. `STATE.md` (human mirror) is regenerated from this file — never hand-edit it as primary.
3. A half-finished phase keeps `stage_status: in_progress`; the gate is always re-run from
   scratch (idempotent), so resuming = re-run the gate and report what's missing.
4. Skipped gates (e.g. an E2/E3 brownfield repo entering past `idea_intake`) carry an explicit
   `entry_stage` + a recorded assumption in `state.yaml` (mirrored to `STATE.md`, never primary),
   exactly like deferred Phase-1 questions.
5. **Keep it minimal.** `state.yaml` holds only *operational* state — the program counter (stage,
   gates, routing, tool/MCP lists, and short pointers like the current sprint id or `last_audit`).
   Long-form detail (sprint bodies, audit findings, package inventories, verification logs) lives in
   `product/*` and `.harness/*`; `state.yaml` references them by path. Do not let it grow into a data dump.
