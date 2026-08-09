# ADR-013: Skill user-surface — UX demote without merging gates

## Status

Accepted — 2026-08-10

## Context

The Midas slash catalog (~36 shipped skills) lists many Phase-7 / close **rituals** as peer commands
(`/midas-progress`, `/midas-qa`, `/midas-diff-gates`, `/midas-lean-review`, `/midas-sweep`). Those
procedures already nest under `/start-sprint`, `/close-sprint`, and `pipeline/7-sprint-execution.md`
([docs/skill-flows.md](../skill-flows.md), [methodology.md](../../harness/methodology.md)). Listing
them as primary `/midas-help` options adds noise without adding gates.

ADR-004 already forbids merging `/close-sprint` with tribunal/security. Soft-pass and Muninn F-007
forbid auto-invoking `disable-model-invocation` skills or softening binding gates. The registry already
separates **Delegator** (`yes` vs `orchestrator-only`) for path-readability — that column is not a
human catalog filter.

## Decision

1. Add frontmatter **`user-surface`**: `primary` | `internal` | `deprecated` (default `primary`).
2. Machine index: `scripts/skill-registry.mjs` emits a **Surface** column (orthogonal to Delegator).
3. **Internal (v1):** `midas-progress`, `midas-qa`, `midas-diff-gates`, `midas-lean-review`,
   `midas-sweep`. Parents **path-pass** (read `SKILL.md` + run steps in the same human-typed
   orchestrator run). Not Skill-tool / auto-slash. Power-users may still type the slash.
4. **Deprecated:** alias stubs (`midas-improve-loop`, `midas-autopilot`, `midas-auto-sprints`) —
   `/midas-help` must not list them.
5. **Keep primary:** phase gates, orient, setup/sync, `/midas-verify`, `/midas-retro`, design,
   capture, investigate, explore, tribunal, security, bundle, `/midas-auto-pilot`, engine
   `/midas-precommit`.
6. **Host discovery:** `.cursor/skills`, `.claude/skills`, `.agents/skills` (and the Claude plugin
   skills tree) **omit** `internal` + `deprecated`. Canonical bodies remain under
   `harness/skills/` / `<paths.engine>/skills/` for path-pass. Power-users may still open those
   paths; they are not advertised in host pickers.
7. Do **not** create a mega `/midas-sprint` that merges start+verify+close (producer ≠ auditor).

## Consequences

- Primary catalog ~29 slash names; ~5 internals demoted (~14–19% less help noise).
- Host pickers drop the same internals + deprecated aliases (additional IDE noise cut).
- Session continuity still requires STM: Phase 7 / start-sprint **must** path-pass progress;
  `/midas-status` warns when `NN-progress.md` is missing.
- `/close-sprint` owns Steps 0 / 0.5 path-pass for sweep / lean / diff-gates (receipts or documented
  skip remain soft-pass requirements).
- Contrasts ADR-004: demote UX ≠ unify audit slash commands.

## Amendment

- **2026-08-10** — Implemented host-mirror filter (omit internal/deprecated from discovery trees);
  scrubbed README / getting-started / methodology / adopt / When NOT peers; renamed stage-table
  `qa_adhoc` → `qa_internal` (path-pass only).
