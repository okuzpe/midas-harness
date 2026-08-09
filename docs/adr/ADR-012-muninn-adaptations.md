# ADR-012 — Muninn pattern adaptations (phased adoption)

- **Status:** accepted
- **Date:** 2026-08-09
- **Extends:** [ADR-003](./ADR-003-project-memory-model.md) (git-visible LTM; no hidden memory store); [ADR-010](./ADR-010-harness-trace-observe.md) (observe-only Trace); [ADR-011](./ADR-011-harness-trace-installs.md) (Cursor hook merge on install)
- **Related:** comparative audit `docs/analisis/muninn-audit/` (local working tree; gitignored);
  [installer outcomes](../installer-outcomes.md) (durable resume exit codes)

## Context

A comparative audit of **muninn-harness** (welocalize, v0.6.69) against Midas produced a structured
ADAPT / INSPIRE / REJECT matrix under `docs/analisis/muninn-audit/`. The audit confirms muninn
strengths in **mechanical safety** (Cursor hooks with deny/ask/allow), **session carryover**, and
**gate receipts**, while Midas retains product lifecycle, multi-host adapters, independent auditor
gates, and git-visible memory (ADR-003).

Muninn is a **Cursor-only, ticket-scoped** harness with a workspace `.ai-flow/` data layer. Midas must
not clone muninn’s architecture, Jira-centric `/flow`, or entry-corpus auto-inject memory — but can
adopt selected patterns **into** existing Midas rituals (`/midas-recall`, `/close-sprint`, installer,
Trace) without contradicting ADR-003 or ADR-010/011.

## Decision

1. **Phased adoption, not a fork.** Muninn ideas ship as incremental Midas capabilities under
   `scripts/` and `cli/lib/steps/`. No `.ai-flow/`, no muninn CLI, no parallel lifecycle.
2. **Session defaults.** An **active session** is true when either (a) `state.yaml` has an active
   sprint, or (b) `{runs}/explore/.active` exists. Safety hooks and carryover bootstrap key off this
   signal; explore mode does not imply a sprint gate.
3. **Cursor safety hooks — merge when `tools` includes `cursor`.** Follow ADR-011’s seed/merge
   pattern for `.cursor/hooks.json`. Safety entries are **separate** from Trace entries and use a
   distinct marker and scripts under `.harness/scripts/safety/*.mjs` (merge via
   `cli/lib/steps/safety-hooks.mjs`). Trace hooks remain **fail-open** (ADR-010); safety hooks may
   **fail-closed** on configured deny rules (destructive commands, unsolicited commits, secret
   patterns).
4. **Gate receipts — production diffs only.** Receipt artifacts (pre-merge evidence that gates ran)
   are required when the working diff touches **production** paths (product source, deploy config,
   public API contracts). Engine-only contributor edits and docs-only diffs do not require receipts.
5. **ADOPT / ADAPT (by priority).**
   - **P0 — Safety hooks + receipt:** Mechanical tool-call guardrails and a lightweight receipt
     record proving hooks evaluated the session (fail-closed path separate from Trace).
   - **P1 — AGENTS bootstrap + carryover:** Per-phase or per-sprint minimal carryover files
     (small; ephemeral under `{paths.cache}/metrics/`) so agents resume without re-reading full
     skills; bootstrap snippet in generated `AGENTS.md` / adapters — not muninn’s full-turn
     `AGENTS.md` contract.
   - **P1 — Gate receipts:** Structured receipt files under `{paths.cache}/gates/<run>/` (split
     `test.json` / `quality.json`) tied to sprint close or pre-commit when production paths change.
   - **P1 — Durable installer resume:** Checkpoint installer/update steps so interrupted installs
     resume idempotently (muninn-inspired, Midas layout).
   - **P2 — Optional context digest / cost / scored recall:** Thin digest of active rules for cost
     control; optional scored path ranking for `/midas-recall` — **never** a hidden corpus,
     auto-inject memory, or BM25 index (ADR-003 floor stands).
6. **REJECT (explicit).**
   - **`/flow` 0–7 + Jira `meta.yml`:** Ticket-scoped state machine; Midas unit of work remains
     phase/sprint under `paths.product` and `{runs}/`.
   - **`memory/entries` + auto-inject:** Hidden scored memory store and per-turn injection; violates
     ADR-003.
   - **Mandatory multi-host hooks:** Safety wiring is Cursor-only when `tools` includes `cursor`;
     other hosts keep declarative rules + auditor CHECKs.
   - **Replace `/close-sprint`:** Muninn self-audit; Midas keeps independent orchestrate-tier close.
   - **Replace `architecture.md` with scraped repo map:** Context map as LTM substitute; architecture
     stays authored in `{product}/architecture.md`.
   - **Langfuse / OTel export as Trace V1:** Observe layer stays local JSONL per ADR-010; no V1
     external telemetry product.

## Implementation

- **Node ESM only.** New modules under `scripts/lib/` and `cli/lib/steps/safety-hooks.mjs`; zero new
  npm dependencies.
- **Trace remains fail-open.** `scripts/trace-hook.mjs` and install copies always exit 0; never
  block agent progress (ADR-010/011 unchanged).
- **Safety fail-closed is separate.** Installer step `cli/lib/steps/safety-hooks.mjs` merges
  Cursor entries that invoke `.harness/scripts/safety/*.mjs`; those scripts own deny/ask/allow
  semantics and must not share exit-code logic with Trace.
- **Cost-aware fan-out.** Within each implementation phase, delegate easy parallel legs (hook merge
  stubs, receipt schema, carryover templates) to **composer-2.5** (or fastest build-tier equivalent);
  orchestrate tier retains ADR/sign-off decisions only.
- **Commit receipts.** After an explicit human commit/push request, agents write
  `node scripts/commit-receipt.mjs write --operation <op>` (installs:
  `node .harness/scripts/commit-receipt.mjs …`); `gate-commits.mjs` consumes the receipt on the next git write.

## Consequences

- New contributor scripts under `scripts/safety/` (`secrets-prompt.mjs`, `gate-commits.mjs`,
  `destructive-shell.mjs`) plus receipt helpers under `scripts/lib/`; installer step
  `cli/lib/steps/safety-hooks.mjs` mirrors ADR-011 Trace merge (marker `safety/`).
- **Ephemeral path cheat-sheet (all under `{paths.cache}/`, gitignored):**
  - Gate receipts → `{paths.cache}/gates/<run>/{test,quality}.json`
  - Carryover snapshot → `{paths.cache}/metrics/current-carryover.json`
  - Commit approval receipt → `{paths.cache}/session/commit-approved.json`
  - Context cost / lifecycle journals → `{paths.cache}/metrics/`
  - Installer lock / journal → `{paths.cache}/installer/`
  - Explore active flag (not cache) → `{runs}/explore/.active`
  Do **not** reintroduce `{runs}/receipts/`, `{runs}/gates/`, or `{runs}/session/` as SoT
  (including freeze-dir — use `{paths.cache}/session/freeze-dir.txt`).
  Durable insight still flows to markdown rituals and `{product}/*` per ADR-003.
- `.cursor/hooks.json` may contain both Trace and safety command entries when `tools` includes
  `cursor`; uninstall/update must strip only Midas-marked entries per hook family.
- Product installs gain optional mechanical safety without adopting muninn’s mono-tool or hidden
  memory model; multi-host projects unchanged except declarative rules and existing gates.
